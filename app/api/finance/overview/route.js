import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const accountId = searchParams.get('accountId');
  const { from, to } = monthRange(month);

  const acctClause = accountId ? ' AND account_id = ?' : '';
  const acctParam = accountId ? [accountId] : [];

  const totalSpend = db.prepare(
    `SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, from, to, ...acctParam).total;

  const totalIncome = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND amount > 0 AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, from, to, ...acctParam).total;

  const uncategorizedCount = db.prepare(
    `SELECT COUNT(*) as n FROM transactions WHERE user_id = ? AND category_id IS NULL${accountId ? ' AND account_id = ?' : ''}`
  ).get(userId, ...acctParam).n;

  const categoryBreakdown = db.prepare(`
    SELECT COALESCE(pc.id, c.id) as category_id, COALESCE(pc.name, c.name) as category_name,
           SUM(-t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ? AND t.amount < 0 AND t.date >= ? AND t.date <= ?${acctClause}
    GROUP BY COALESCE(pc.id, c.id)
    ORDER BY total DESC
  `).all(userId, from, to, ...acctParam);

  return NextResponse.json({ month, totalSpend, totalIncome, uncategorizedCount, categoryBreakdown });
}
