import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const uncategorized = searchParams.get('uncategorized') === '1';
  const accountId  = searchParams.get('accountId');
  const categoryId = searchParams.get('categoryId');
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const q    = searchParams.get('q');

  let sql = `
    SELECT t.*, a.name as account_name, a.color as account_color, a.type as account_type,
           c.name as category_name, c.parent_id as category_parent_id, pc.name as parent_category_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ?
  `;
  const params = [userId];
  if (uncategorized) sql += ' AND t.category_id IS NULL';
  if (accountId)  { sql += ' AND t.account_id = ?'; params.push(accountId); }
  if (categoryId) { sql += ' AND (t.category_id = ? OR c.parent_id = ?)'; params.push(categoryId, categoryId); }
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to)   { sql += ' AND t.date <= ?'; params.push(to); }
  if (q)    { sql += ' AND t.description LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY t.date DESC, t.id DESC';

  const rows = db.prepare(sql).all(...params);
  return NextResponse.json(rows);
}
