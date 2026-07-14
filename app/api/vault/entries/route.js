import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const rows = await sql`
    SELECT id, title, url, blob_iv, blob_ct FROM vault_entries
    WHERE user_id = ${session.user.id}
    ORDER BY title ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { title, url, blob_iv, blob_ct } = await req.json();
  if (!title?.trim() || !blob_iv || !blob_ct) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const [row] = await sql`
    INSERT INTO vault_entries (user_id, title, url, blob_iv, blob_ct)
    VALUES (${session.user.id}, ${title.trim()}, ${url?.trim() || null}, ${blob_iv}, ${blob_ct})
    RETURNING id, title, url, blob_iv, blob_ct
  `;
  return NextResponse.json(row, { status: 201 });
}
