import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { requireAssistantKey } from '../../../../lib/assistantAuth';
import { istDateKey } from '../../../../lib/dates';

export async function GET(req) {
  const userId = await requireAssistantKey(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days')) || 14;
  const from = new Date();
  from.setDate(from.getDate() - days);

  const rows = await sql`
    SELECT log_date, day, exercise, sets, skipped, skip_reason, notes
    FROM workout_logs
    WHERE user_id = ${userId} AND log_date >= ${istDateKey(from)}::date
    ORDER BY log_date DESC, created_at ASC
  `;
  return NextResponse.json(rows);
}
