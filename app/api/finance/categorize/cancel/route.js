import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';
import { activeRuns } from '../../../../../lib/finance/categorizeControl';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  // Flag the run cancelled — the loop checks this between batches and stops gracefully,
  // leaving everything tagged so far intact.
  const res = db.prepare(`UPDATE categorize_jobs SET status='cancelled', updated_at=datetime('now') WHERE user_id=? AND status='running'`).run(userId);

  // Abort the in-flight model call too, so it stops within seconds instead of at the
  // next batch boundary.
  const ac = activeRuns.get(userId);
  if (ac) { try { ac.abort(); } catch {} }

  return NextResponse.json({ cancelled: res.changes > 0 });
}
