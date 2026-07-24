import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { normalizeMerchantKey } from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { istDateKey } from '../../../../lib/dates';

// Manual entry — e.g. cash spent from your wallet that never hits a statement.
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { amount, description, date, categoryId, accountId, type } = await req.json();
  const amt = Number(amount);
  if (!amt || isNaN(amt)) return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  const signed = type === 'income' ? Math.abs(amt) : -Math.abs(amt);

  // resolve account: use the given one, else get-or-create a "Cash" bank account
  let acctId = accountId ? Number(accountId) : null;
  if (acctId) {
    const owned = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(acctId, userId);
    if (!owned) return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
  } else {
    const cash = db.prepare("SELECT id FROM accounts WHERE user_id = ? AND name = 'Cash'").get(userId);
    acctId = cash ? cash.id : db.prepare("INSERT INTO accounts (user_id, name, type, color) VALUES (?, 'Cash', 'bank_account', '#16a34a')").run(userId).lastInsertRowid;
  }

  const desc = description.trim();
  const info = db.prepare(
    'INSERT INTO transactions (user_id, account_id, date, description, merchant_key, amount, category_id, txn_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, acctId, date || istDateKey(), desc, normalizeMerchantKey(desc), signed, categoryId ?? null, 'manual-' + crypto.randomUUID());

  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  return NextResponse.json(txn, { status: 201 });
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const uncategorized = searchParams.get('uncategorized') === '1';
  const categorized = searchParams.get('categorized') === '1';
  const accountId  = searchParams.get('accountId');
  const categoryId = searchParams.get('categoryId');
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const q    = searchParams.get('q');
  const label = searchParams.get('label');
  const type = searchParams.get('type');   // 'spend' | 'income'
  const min  = searchParams.get('min');    // absolute amount
  const max  = searchParams.get('max');

  let sql = `
    SELECT t.*, a.name as account_name, a.color as account_color, a.type as account_type,
           c.name as category_name, c.parent_id as category_parent_id, pc.name as parent_category_name,
           (SELECT GROUP_CONCAT(tl.label, '') FROM tx_labels tl WHERE tl.transaction_id = t.id) as labels_csv
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ?
  `;
  const params = [userId];
  if (uncategorized) sql += ' AND t.category_id IS NULL';
  if (categorized)   sql += ' AND t.category_id IS NOT NULL';
  if (accountId)  { sql += ' AND t.account_id = ?'; params.push(accountId); }
  if (categoryId) { sql += ' AND (t.category_id = ? OR c.parent_id = ?)'; params.push(categoryId, categoryId); }
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to)   { sql += ' AND t.date <= ?'; params.push(to); }
  if (q)    { sql += ' AND t.description LIKE ?'; params.push(`%${q}%`); }
  if (label) { sql += ' AND t.id IN (SELECT transaction_id FROM tx_labels WHERE user_id = ? AND label = ?)'; params.push(userId, label); }
  if (type === 'spend')  sql += ' AND t.amount < 0';
  if (type === 'income') sql += ' AND t.amount > 0';
  if (min && !isNaN(min)) { sql += ' AND ABS(t.amount) >= ?'; params.push(Number(min)); }
  if (max && !isNaN(max)) { sql += ' AND ABS(t.amount) <= ?'; params.push(Number(max)); }
  sql += ' ORDER BY t.date DESC, t.id DESC';

  const rows = db.prepare(sql).all(...params).map(r => {
    const { labels_csv, ...rest } = r;
    return { ...rest, labels: labels_csv ? labels_csv.split('') : [] };
  });
  return NextResponse.json(rows);
}
