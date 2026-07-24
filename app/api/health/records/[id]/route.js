import { NextResponse } from 'next/server';
import sql from '../../../../../lib/db';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  const cur = (await sql`SELECT * FROM health_records WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { kind, date, title, doctor, place, details } = await req.json();
  const [row] = await sql`
    UPDATE health_records SET
      kind    = ${kind    !== undefined ? kind : cur.kind},
      date    = ${date    !== undefined ? (date || null) : cur.date},
      title   = ${title   !== undefined ? (title ?? cur.title) : cur.title},
      doctor  = ${doctor  !== undefined ? doctor : cur.doctor},
      place   = ${place   !== undefined ? place : cur.place},
      details = ${details !== undefined ? details : cur.details}
    WHERE id = ${id} AND user_id = ${uid} RETURNING *
  `;
  const files = await sql`SELECT id, name, mime FROM health_files WHERE record_id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ...row, files });
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  await sql`DELETE FROM health_files   WHERE record_id = ${id} AND user_id = ${uid}`;
  await sql`DELETE FROM health_records WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
