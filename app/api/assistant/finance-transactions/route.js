import { NextResponse } from 'next/server';
import financeDb from '../../../../lib/financeDb';
import { requireAssistantKey } from '../../../../lib/assistantAuth';

export async function GET(req) {
  const userId = await requireAssistantKey(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const q    = searchParams.get('q');

  let sql = `
    SELECT t.date, t.description, t.amount, a.name as account_name,
           c.name as category_name, pc.name as parent_category_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ?
  `;
  const params = [userId];
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to)   { sql += ' AND t.date <= ?'; params.push(to); }
  if (q)    { sql += ' AND t.description LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY t.date DESC, t.id DESC LIMIT 200';

  const rows = financeDb.prepare(sql).all(...params);
  return NextResponse.json(rows);
}
