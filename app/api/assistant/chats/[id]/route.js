import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../../lib/db';
import { auth } from '../../../../../auth';

export async function GET(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await initDb();
  const [row] = await sql`SELECT id, title, model, messages FROM chats WHERE id = ${id} AND user_id = ${session.user.id}`;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ id: row.id, title: row.title, model: row.model, messages: row.messages || [] });
}

// upsert — the client saves the full message list after each exchange
export async function PUT(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  const { title, model, messages } = await req.json();
  await initDb();
  await sql`
    INSERT INTO chats (id, user_id, title, model, messages, updated_at)
    VALUES (${id}, ${uid}, ${(title || 'New chat').slice(0, 120)}, ${model ?? null}, ${sql.json(messages ?? [])}, NOW())
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, model = EXCLUDED.model, messages = EXCLUDED.messages, updated_at = NOW()
    WHERE chats.user_id = ${uid}
  `;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  await sql`UPDATE chats SET title = ${title.trim().slice(0, 120)} WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM chats WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
