import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const rows = await sql`
    SELECT * FROM routines
    WHERE user_id = ${session.user.id} AND archived = false
    ORDER BY time ASC NULLS LAST, sort_order ASC, created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { title, time, days } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const [row] = await sql`
    INSERT INTO routines (user_id, title, time, days)
    VALUES (${session.user.id}, ${title.trim()}, ${time || null}, ${days ?? []})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
