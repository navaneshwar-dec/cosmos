import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../../lib/db';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  await initDb();

  const current = (await sql`SELECT * FROM vault_entries WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, url, blob_iv, blob_ct } = await req.json();
  await sql`
    UPDATE vault_entries SET
      title      = ${title    !== undefined ? (title?.trim() || current.title) : current.title},
      url        = ${url      !== undefined ? (url?.trim() || null)            : current.url},
      blob_iv    = ${blob_iv  !== undefined ? blob_iv                          : current.blob_iv},
      blob_ct    = ${blob_ct  !== undefined ? blob_ct                          : current.blob_ct},
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${uid}
  `;
  const [row] = await sql`SELECT id, title, url, blob_iv, blob_ct FROM vault_entries WHERE id = ${id}`;
  return NextResponse.json(row);
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await initDb();
  await sql`DELETE FROM vault_entries WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
