import { NextResponse } from 'next/server';
import financeDb from '../../../../lib/financeDb';
import { requireAssistantKey } from '../../../../lib/assistantAuth';
import { istMonthKey } from '../../../../lib/dates';

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export async function GET(req) {
  const userId = await requireAssistantKey(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || istMonthKey();
  const { from, to } = monthRange(month);

  const totalSpend = financeDb.prepare(
    `SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?`
  ).get(userId, from, to).total;

  const totalIncome = financeDb.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND amount > 0 AND date >= ? AND date <= ?`
  ).get(userId, from, to).total;

  const categoryBreakdown = financeDb.prepare(`
    SELECT COALESCE(pc.name, c.name) as category_name, SUM(-t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ? AND t.amount < 0 AND t.date >= ? AND t.date <= ?
    GROUP BY COALESCE(pc.id, c.id)
    ORDER BY total DESC
  `).all(userId, from, to);

  return NextResponse.json({ month, totalSpend, totalIncome, categoryBreakdown });
}
