import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const uid  = session.user.id;

  if (from && to) {
    const rows = await sql`
      SELECT * FROM workout_logs
      WHERE user_id = ${uid}
        AND log_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY log_date DESC, created_at ASC
    `;
    return NextResponse.json(rows);
  }

  const rows = await sql`
    SELECT * FROM workout_logs
    WHERE user_id = ${uid}
      AND log_date = ${date ?? new Date().toISOString().split('T')[0]}::date
    ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { log_date, day, exercise, started_at, ended_at, sets, skipped, skip_reason, notes } = await req.json();
  const uid = session.user.id;

  const [row] = await sql`
    INSERT INTO workout_logs (user_id, log_date, day, exercise, started_at, ended_at, sets, skipped, skip_reason, notes)
    VALUES (
      ${uid},
      ${log_date}::date,
      ${day},
      ${exercise},
      ${started_at}::timestamptz,
      ${ended_at ?? null}::timestamptz,
      ${JSON.stringify(sets ?? [])}::jsonb,
      ${skipped ?? false},
      ${skip_reason ?? null},
      ${notes ?? null}
    )
    ON CONFLICT (user_id, log_date, exercise) DO UPDATE SET
      started_at  = EXCLUDED.started_at,
      ended_at    = EXCLUDED.ended_at,
      sets        = EXCLUDED.sets,
      skipped     = EXCLUDED.skipped,
      skip_reason = EXCLUDED.skip_reason,
      notes       = EXCLUDED.notes
    RETURNING *
  `;
  return NextResponse.json(row);
}

export async function DELETE(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const date     = searchParams.get('date');
  const exercise = searchParams.get('exercise');
  await sql`
    DELETE FROM workout_logs
    WHERE user_id = ${session.user.id} AND log_date = ${date}::date AND exercise = ${exercise}
  `;
  return NextResponse.json({ ok: true });
}
