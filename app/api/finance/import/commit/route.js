import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { normalizeMerchantKey } from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';
import { parseWorkbook, mappingIsValid, extractTransactions } from '../../../../../lib/statementParser';
import { getProcessor } from '../../../../../lib/finance/processors';
import { decryptSecret } from '../../../../../lib/financeCrypto';

export const runtime = 'nodejs';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const accountId = formData.get('accountId');
  const mappingRaw = formData.get('mapping');
  if (!file || !accountId) return NextResponse.json({ error: 'Missing file or account' }, { status: 400 });

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, session.user.id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const processor = getProcessor(account.processor);

  let transactions, skipped, mapping = null;
  if (processor) {
    // source has a dedicated processor: decrypt with the stored password + parse its format
    const password = account.password_enc ? decryptSecret(account.password_enc) : null;
    try {
      ({ transactions, skipped } = await processor.parse(buffer, { password }));
    } catch (e) {
      return NextResponse.json({ error: `Could not read the file: ${e.message}` }, { status: 400 });
    }
  } else {
    if (!mappingRaw) return NextResponse.json({ error: 'Missing column mapping' }, { status: 400 });
    try { mapping = JSON.parse(mappingRaw); } catch { return NextResponse.json({ error: 'Invalid mapping' }, { status: 400 }); }
    const { headers, rows } = parseWorkbook(buffer);
    if (!mappingIsValid(mapping, headers)) return NextResponse.json({ error: 'Column mapping does not match file headers' }, { status: 400 });
    ({ transactions, skipped } = extractTransactions(headers, rows, mapping, account.type));
  }

  const userId = session.user.id;
  const ruleStmt = db.prepare('SELECT category_id FROM merchant_rules WHERE user_id = ? AND merchant_key = ? AND is_credit = ?');
  // dedup on a stable txn_uid (unique index) — INSERT OR IGNORE skips re-imported rows.
  const insertTx = db.prepare(
    'INSERT OR IGNORE INTO transactions (user_id, account_id, statement_id, date, description, merchant_key, amount, category_id, txn_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertStatement = db.prepare(
    'INSERT INTO statements (user_id, account_id, filename, row_count) VALUES (?, ?, ?, ?)'
  );
  const upsertMapping = db.prepare(`
    INSERT INTO import_mappings (user_id, issuer, column_map, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, issuer) DO UPDATE SET column_map = excluded.column_map, updated_at = datetime('now')
  `);

  let imported = 0, duplicates = 0;
  const statementId = db.transaction(() => {
    const stmtResult = insertStatement.run(userId, accountId, file.name ?? null, 0);
    const sid = stmtResult.lastInsertRowid;

    for (const t of transactions) {
      const merchantKey = normalizeMerchantKey(t.description);
      const rule = ruleStmt.get(userId, merchantKey, t.amount > 0 ? 1 : 0);
      // stable id: prefer the bank's own reference when a processor supplies one, else a content hash
      const basis = t.ref ? `${accountId}|ref|${t.ref}` : `${accountId}|${t.date}|${t.amount}|${t.description}`;
      const txnUid = crypto.createHash('sha256').update(basis).digest('hex').slice(0, 40);
      const info = insertTx.run(userId, accountId, sid, t.date, t.description, merchantKey, t.amount, rule?.category_id ?? null, txnUid);
      if (info.changes === 0) duplicates++; else imported++;
    }

    db.prepare('UPDATE statements SET row_count = ? WHERE id = ?').run(imported, sid);

    if (mapping) {
      const issuerKey = (account.issuer || account.name).trim().toLowerCase();
      upsertMapping.run(userId, issuerKey, JSON.stringify(mapping));
    }

    return sid;
  })();

  return NextResponse.json({ imported, skipped, duplicates, statementId });
}
