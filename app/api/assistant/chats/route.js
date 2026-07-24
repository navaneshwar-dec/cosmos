import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const rows = await sql`SELECT id, title, model, updated_at FROM chats WHERE user_id = ${session.user.id} ORDER BY updated_at DESC LIMIT 100`;
  return NextResponse.json(rows);
}
