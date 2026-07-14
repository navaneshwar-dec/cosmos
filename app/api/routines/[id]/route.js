import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  await initDb();

  const current = (await sql`SELECT * FROM routines WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, time, days, archived } = await req.json();
  await sql`
    UPDATE routines SET
      title    = ${title    !== undefined ? (title?.trim() || current.title) : current.title},
      time     = ${time     !== undefined ? (time || null)                   : current.time},
      days     = ${days     !== undefined ? days                             : current.days},
      archived = ${archived !== undefined ? archived                         : current.archived}
    WHERE id = ${id} AND user_id = ${uid}
  `;
  const [row] = await sql`SELECT * FROM routines WHERE id = ${id}`;
  return NextResponse.json(row);
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  await initDb();
  await sql`DELETE FROM routine_logs WHERE routine_id = ${id} AND user_id = ${uid}`;
  await sql`DELETE FROM routines WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
