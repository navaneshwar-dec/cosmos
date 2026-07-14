import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

const COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#0d9488', '#ec4899', '#8b5cf6'];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const people = await sql`SELECT * FROM people WHERE user_id = ${session.user.id} ORDER BY name ASC`;
  return NextResponse.json(people);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const uid = session.user.id;
  const clean = name.trim();

  // Re-adding an existing name resolves to the same person (append to same guy).
  const existing = (await sql`SELECT * FROM people WHERE user_id = ${uid} AND name = ${clean}`)[0];
  if (existing) return NextResponse.json(existing);

  const count = (await sql`SELECT COUNT(*)::int AS n FROM people WHERE user_id = ${uid}`)[0].n;
  const color = COLORS[count % COLORS.length];

  const [person] = await sql`
    INSERT INTO people (user_id, name, color) VALUES (${uid}, ${clean}, ${color})
    ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  return NextResponse.json(person, { status: 201 });
}
