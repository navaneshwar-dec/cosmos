import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';
import { hashPassword } from '../../../../lib/password';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const [u] = await sql`SELECT email, password_hash FROM users WHERE id = ${session.user.id}`;
  return NextResponse.json({ hasPassword: !!u?.password_hash, email: u?.email ?? session.user.email });
}

// set / change the current user's password (they must be logged in already)
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { password } = await req.json();
  if (!password || String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  await initDb();
  await sql`UPDATE users SET password_hash = ${hashPassword(String(password))} WHERE id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
