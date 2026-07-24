import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { istMonthKey } from '../../../../lib/dates';

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
  const month = searchParams.get('month') || istMonthKey();
  const accountId = searchParams.get('accountId');
  const { from, to } = monthRange(month);

  const acctClause = accountId ? ' AND account_id = ?' : '';
  const acctParam = accountId ? [accountId] : [];

  // "Transfers" (top-level category + its subcategories) are money moved, not spending —
  // excluded from all spend figures and surfaced separately. Uncategorized rows stay in
  // spend (the NULL guard) until they get tagged.
  const transferIds = db.prepare(`
    SELECT c.id FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
    WHERE c.user_id = ? AND COALESCE(p.name, c.name) = 'Transfers'
  `).all(userId).map(r => r.id);
  const tph = transferIds.map(() => '?').join(',');
  const exTransfer  = transferIds.length ? ` AND (category_id IS NULL OR category_id NOT IN (${tph}))` : '';
  const exTransferT = transferIds.length ? ` AND (t.category_id IS NULL OR t.category_id NOT IN (${tph}))` : '';
  const txp = transferIds;

  const totalSpend = db.prepare(
    `SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause}${exTransfer}`
  ).get(userId, from, to, ...acctParam, ...txp).total;

  const totalIncome = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND amount > 0 AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, from, to, ...acctParam).total;

  // scoped to the viewed month so the banner reflects "this month", not the all-time backlog
  const uncategorizedCount = db.prepare(
    `SELECT COUNT(*) as n FROM transactions WHERE user_id = ? AND category_id IS NULL AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, from, to, ...acctParam).n;

  const categoryBreakdown = db.prepare(`
    SELECT COALESCE(pc.id, c.id) as category_id, COALESCE(pc.name, c.name) as category_name,
           SUM(-t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE t.user_id = ? AND t.amount < 0 AND t.date >= ? AND t.date <= ?${acctClause}${exTransferT}
    GROUP BY COALESCE(pc.id, c.id)
    ORDER BY total DESC
  `).all(userId, from, to, ...acctParam, ...txp);

  const latestMonth = db.prepare(
    `SELECT MAX(substr(date, 1, 7)) as m FROM transactions WHERE user_id = ?${acctClause}`
  ).get(userId, ...acctParam).m;

  // prior month, for month-over-month comparison on the KPI cards
  const [py, pm] = month.split('-').map(Number);
  const pd = new Date(py, pm - 2, 1);
  const prevMonth = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
  const { from: pf, to: pt } = monthRange(prevMonth);
  const prevSpend = db.prepare(
    `SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause}${exTransfer}`
  ).get(userId, pf, pt, ...acctParam, ...txp).total;
  const prevIncome = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND amount > 0 AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, pf, pt, ...acctParam).total;

  const txnCount = db.prepare(
    `SELECT COUNT(*) as n FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?${acctClause}`
  ).get(userId, from, to, ...acctParam).n;

  // top merchants this month (by spend). merchant_key groups the same payee; show a
  // readable sample description.
  const topMerchants = db.prepare(`
    SELECT COALESCE(merchant_key, description) as key, MIN(description) as name, SUM(-amount) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause}${exTransfer}
    GROUP BY COALESCE(merchant_key, description)
    ORDER BY total DESC
    LIMIT 5
  `).all(userId, from, to, ...acctParam, ...txp);

  // per-day spend for the calendar heatmap (transfers excluded)
  const dailySpend = db.prepare(`
    SELECT date, SUM(-amount) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause}${exTransfer}
    GROUP BY date
  `).all(userId, from, to, ...acctParam, ...txp);

  // money moved via transfers this month — shown separately, not as spend
  const totalTransfers = transferIds.length ? db.prepare(
    `SELECT COALESCE(SUM(-amount), 0) as total FROM transactions WHERE user_id = ? AND amount < 0 AND date >= ? AND date <= ?${acctClause} AND category_id IN (${tph})`
  ).get(userId, from, to, ...acctParam, ...transferIds).total : 0;

  // top-level Transfers category id, so the Transfers tile can deep-link into Transactions
  const transfersCategoryId = db.prepare(`SELECT id FROM categories WHERE user_id = ? AND name = 'Transfers' AND parent_id IS NULL`).get(userId)?.id ?? null;

  return NextResponse.json({ month, totalSpend, totalIncome, prevSpend, prevIncome, txnCount, uncategorizedCount, totalTransfers, transfersCategoryId, categoryBreakdown, topMerchants, dailySpend, latestMonth });
}
