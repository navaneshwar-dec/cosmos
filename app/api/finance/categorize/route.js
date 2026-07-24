import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { isOllamaAvailable, categorizeBatch } from '../../../../lib/llmCategorizer';
import { activeRuns } from '../../../../lib/finance/categorizeControl';

export const runtime = 'nodejs';
export const maxDuration = 600;

const BATCH_SIZE = 8;   // smaller = more frequent progress + less redone on a stall

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const available = await isOllamaAvailable();
  if (!available) {
    return NextResponse.json({ error: 'Ollama is not running. Start it (open the Ollama app, or run `ollama serve`) and try again.' }, { status: 503 });
  }

  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId);
  const childCount = new Map();
  categories.forEach(c => { if (c.parent_id) childCount.set(c.parent_id, (childCount.get(c.parent_id) ?? 0) + 1); });

  // Mirrors the CategoryPicker UI: a childless top-level category is directly taggable;
  // a top-level with subcategories is not — the model must pick a subcategory, same as a human would.
  const pathToId = new Map();
  for (const c of categories) {
    if (!c.parent_id && !childCount.has(c.id)) {
      pathToId.set(c.name, c.id);
    } else if (c.parent_id) {
      const parent = categories.find(p => p.id === c.parent_id);
      pathToId.set(`${parent.name} > ${c.name}`, c.id);
    }
  }
  const categoryPaths = [...pathToId.keys()];
  const idToPath = new Map([...pathToId].map(([path, cid]) => [cid, path]));

  // The user's own past corrections (merchant_rules) become few-shot examples so the
  // model learns their preferences. Cap to the most recent so the prompt stays bounded.
  const examples = db.prepare(`
    SELECT mr.merchant_key, mr.is_credit, mr.category_id, MIN(t.description) as description
    FROM merchant_rules mr
    LEFT JOIN transactions t ON t.user_id = mr.user_id AND t.merchant_key = mr.merchant_key
                            AND (CASE WHEN t.amount > 0 THEN 1 ELSE 0 END) = mr.is_credit
    WHERE mr.user_id = ?
    GROUP BY mr.merchant_key, mr.is_credit
    ORDER BY MAX(mr.id) DESC
    LIMIT 24
  `).all(userId)
    .map(r => ({ text: r.description || r.merchant_key, category: idToPath.get(r.category_id), is_credit: r.is_credit }))
    .filter(e => e.text && e.category);

  // Group by (merchant_key, direction): the same merchant can be a credit in one row and
  // a debit in another, and each direction is categorized — and applied — independently.
  const merchants = db.prepare(`
    SELECT merchant_key, MIN(description) as description, CASE WHEN amount > 0 THEN 1 ELSE 0 END as is_credit
    FROM transactions
    WHERE user_id = ? AND category_id IS NULL AND merchant_key IS NOT NULL
    GROUP BY merchant_key, CASE WHEN amount > 0 THEN 1 ELSE 0 END
  `).all(userId);
  const total = merchants.length;

  const bulkUpdate = db.prepare(`UPDATE transactions SET category_id = ? WHERE user_id = ? AND merchant_key = ? AND category_id IS NULL AND (CASE WHEN amount > 0 THEN 1 ELSE 0 END) = ?`);
  const upsertRule = db.prepare(`
    INSERT INTO merchant_rules (user_id, merchant_key, is_credit, category_id) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, merchant_key, is_credit) DO UPDATE SET category_id = excluded.category_id
  `);

  // Persisted job record — the source of truth for progress, so a refreshed or
  // reopened tab can pick the run back up (and the run itself keeps going even if
  // the client that started it disconnects).
  const upsertJob = db.prepare(`
    INSERT INTO categorize_jobs (user_id, status, total, done, tagged, recent, error, started_at, updated_at)
    VALUES (?, 'running', ?, 0, 0, '[]', NULL, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      status='running', total=excluded.total, done=0, tagged=0, recent='[]', error=NULL,
      started_at=datetime('now'), updated_at=datetime('now')
  `);
  const tickJob = db.prepare(`UPDATE categorize_jobs SET done=?, tagged=?, recent=?, updated_at=datetime('now') WHERE user_id=?`);
  const finishJob = db.prepare(`UPDATE categorize_jobs SET status=?, error=?, updated_at=datetime('now') WHERE user_id=?`);
  const jobStatus = db.prepare(`SELECT status FROM categorize_jobs WHERE user_id=?`);

  const batches = Math.ceil(total / BATCH_SIZE);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientOpen = true;
      // guarded enqueue: if the client has gone away the stream errors, but the
      // categorization loop must keep running and persisting to the job record.
      const send = obj => { if (!clientOpen) return; try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch { clientOpen = false; } };
      const close = () => { try { controller.close(); } catch {} };

      const ac = new AbortController();
      activeRuns.set(userId, ac);
      const cleanup = () => { if (activeRuns.get(userId) === ac) activeRuns.delete(userId); };

      upsertJob.run(userId, total);
      send({ total, batches, done: 0, tagged: 0 });
      if (total === 0) { finishJob.run('done', null, userId); send({ complete: true, total: 0, done: 0, tagged: 0 }); cleanup(); close(); return; }

      let done = 0, tagged = 0, recent = [];
      for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
        // graceful cancel: user hit Stop → leave already-tagged work, exit cleanly
        if (jobStatus.get(userId)?.status === 'cancelled') { send({ cancelled: true, total, batches, done, tagged }); cleanup(); close(); return; }
        const batch = merchants.slice(i, i + BATCH_SIZE);
        const justTagged = [];
        try {
          const results = await categorizeBatch(batch, categoryPaths, examples, ac.signal);
          const applyBatch = db.transaction(() => {
            for (const { merchant, category: path } of results) {
              const categoryId = pathToId.get(path);
              if (!categoryId) continue;
              upsertRule.run(userId, merchant.merchant_key, merchant.is_credit, categoryId);
              bulkUpdate.run(categoryId, userId, merchant.merchant_key, merchant.is_credit);
              tagged++;
              justTagged.push({ merchant: (merchant.description || merchant.merchant_key).slice(0, 40), category: path });
            }
          });
          applyBatch();
        } catch (err) {
          // batch failed (timeout/parse) — its merchants stay untagged and are picked up on Resume
          send({ total, batches, batch: i / BATCH_SIZE + 1, done, tagged, batchError: err?.message ?? String(err) });
        }
        done += batch.length;
        recent = [...justTagged, ...recent].slice(0, 8);
        tickJob.run(done, tagged, JSON.stringify(recent), userId);
        send({ total, batches, batch: i / BATCH_SIZE + 1, done, tagged, justTagged });
      }

      // a cancel that landed during the final batch shouldn't get overwritten with 'done'
      if (jobStatus.get(userId)?.status === 'cancelled') { send({ cancelled: true, total, batches, done, tagged }); cleanup(); close(); return; }
      finishJob.run('done', null, userId);
      send({ complete: true, total, done, tagged });
      cleanup();
      close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' } });
}
