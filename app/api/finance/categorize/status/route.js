import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';

// A run that hasn't ticked in this many seconds is treated as dead (process/tab gone),
// so the UI can offer Resume instead of spinning forever.
const STALE_SECONDS = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const job = db.prepare(`
    SELECT status, total, done, tagged, recent, error,
           CAST(strftime('%s','now') - strftime('%s', updated_at) AS INTEGER) AS age_seconds
    FROM categorize_jobs WHERE user_id = ?
  `).get(session.user.id);

  if (!job) return NextResponse.json({ job: null });

  let recent = [];
  try { recent = JSON.parse(job.recent || '[]'); } catch {}
  const stale = job.status === 'running' && job.age_seconds > STALE_SECONDS;

  return NextResponse.json({
    job: { status: job.status, total: job.total, done: job.done, tagged: job.tagged, error: job.error, recent, stale, ageSeconds: job.age_seconds },
  });
}
