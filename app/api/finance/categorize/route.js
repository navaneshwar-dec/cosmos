import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { isOllamaAvailable, categorizeBatch } from '../../../../lib/llmCategorizer';

const BATCH_SIZE = 20;

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

  const merchants = db.prepare(`
    SELECT merchant_key, MIN(description) as description
    FROM transactions
    WHERE user_id = ? AND category_id IS NULL AND merchant_key IS NOT NULL
    GROUP BY merchant_key
  `).all(userId);
  const total = merchants.length;

  const bulkUpdate = db.prepare('UPDATE transactions SET category_id = ? WHERE user_id = ? AND merchant_key = ? AND category_id IS NULL');
  const upsertRule = db.prepare(`
    INSERT INTO merchant_rules (user_id, merchant_key, category_id) VALUES (?, ?, ?)
    ON CONFLICT(user_id, merchant_key) DO UPDATE SET category_id = excluded.category_id
  `);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); }

      send({ total, done: 0, tagged: 0 });
      if (total === 0) { controller.close(); return; }

      let done = 0, tagged = 0;
      for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
        const batch = merchants.slice(i, i + BATCH_SIZE);
        try {
          const results = await categorizeBatch(batch, categoryPaths);
          const applyBatch = db.transaction(() => {
            for (const [merchantKey, path] of results) {
              const categoryId = pathToId.get(path);
              if (!categoryId) continue;
              upsertRule.run(userId, merchantKey, categoryId);
              bulkUpdate.run(categoryId, userId, merchantKey);
              tagged++;
            }
          });
          applyBatch();
        } catch (err) {
          send({ total, done, tagged, batchError: err?.message ?? String(err) });
        }
        done += batch.length;
        send({ total, done, tagged });
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}
