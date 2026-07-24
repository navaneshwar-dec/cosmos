import { NextResponse } from 'next/server';
import sql from '../../../../../lib/db';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  const cur = (await sql`SELECT * FROM health_profiles WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { name, relation, dob, blood_group, notes } = await req.json();
  const [row] = await sql`
    UPDATE health_profiles SET
      name        = ${name        !== undefined ? (name ?? cur.name) : cur.name},
      relation    = ${relation    !== undefined ? relation    : cur.relation},
      dob         = ${dob         !== undefined ? (dob || null) : cur.dob},
      blood_group = ${blood_group !== undefined ? blood_group : cur.blood_group},
      notes       = ${notes       !== undefined ? notes       : cur.notes}
    WHERE id = ${id} AND user_id = ${uid} RETURNING *
  `;
  return NextResponse.json(row);
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  // remove file refs + records + the profile (Drive files are left in the user's Drive)
  await sql`DELETE FROM health_files   WHERE user_id = ${uid} AND record_id IN (SELECT id FROM health_records WHERE profile_id = ${id})`;
  await sql`DELETE FROM health_records WHERE user_id = ${uid} AND profile_id = ${id}`;
  await sql`DELETE FROM health_profiles WHERE id = ${id} AND user_id = ${uid}`;
  return NextResponse.json({ ok: true });
}
