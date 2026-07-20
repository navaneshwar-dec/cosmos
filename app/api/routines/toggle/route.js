import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';
import { istDateKey } from '../../../../lib/dates';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const uid = session.user.id;
  const { routineId, date, done } = await req.json();
  const day = date || istDateKey();

  const owns = (await sql`SELECT 1 FROM routines WHERE id = ${routineId} AND user_id = ${uid}`)[0];
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (done) {
    await sql`
      INSERT INTO routine_logs (user_id, routine_id, log_date)
      VALUES (${uid}, ${routineId}, ${day}::date)
      ON CONFLICT (user_id, routine_id, log_date) DO NOTHING
    `;
  } else {
    await sql`DELETE FROM routine_logs WHERE user_id = ${uid} AND routine_id = ${routineId} AND log_date = ${day}::date`;
  }
  return NextResponse.json({ ok: true, routineId, date: day, done: !!done });
}
