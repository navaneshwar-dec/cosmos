import { NextResponse } from 'next/server';
import db, { normalizeMerchantKey } from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';
import { parseWorkbook, mappingIsValid, extractTransactions } from '../../../../../lib/statementParser';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const accountId = formData.get('accountId');
  const mappingRaw = formData.get('mapping');
  if (!file || !accountId || !mappingRaw) return NextResponse.json({ error: 'Missing file, account, or mapping' }, { status: 400 });

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, session.user.id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  let mapping;
  try { mapping = JSON.parse(mappingRaw); } catch { return NextResponse.json({ error: 'Invalid mapping' }, { status: 400 }); }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = parseWorkbook(buffer);
  if (!mappingIsValid(mapping, headers)) return NextResponse.json({ error: 'Column mapping does not match file headers' }, { status: 400 });

  const { transactions, skipped } = extractTransactions(headers, rows, mapping);

  const userId = session.user.id;
  const existsStmt = db.prepare(
    'SELECT 1 FROM transactions WHERE user_id = ? AND account_id = ? AND date = ? AND description = ? AND amount = ?'
  );
  const ruleStmt = db.prepare('SELECT category_id FROM merchant_rules WHERE user_id = ? AND merchant_key = ?');
  const insertTx = db.prepare(
    'INSERT INTO transactions (user_id, account_id, statement_id, date, description, merchant_key, amount, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
      if (existsStmt.get(userId, accountId, t.date, t.description, t.amount)) { duplicates++; continue; }
      const merchantKey = normalizeMerchantKey(t.description);
      const rule = ruleStmt.get(userId, merchantKey);
      insertTx.run(userId, accountId, sid, t.date, t.description, merchantKey, t.amount, rule?.category_id ?? null);
      imported++;
    }

    db.prepare('UPDATE statements SET row_count = ? WHERE id = ?').run(imported, sid);

    const issuerKey = (account.issuer || account.name).trim().toLowerCase();
    upsertMapping.run(userId, issuerKey, JSON.stringify(mapping));

    return sid;
  })();

  return NextResponse.json({ imported, skipped, duplicates, statementId });
}
