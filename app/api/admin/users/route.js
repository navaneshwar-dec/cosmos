import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';
import { auth } from '../../../../auth';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await sql`
    SELECT id, email, name, picture, prayer_enabled, is_admin, created_at
    FROM users
    ORDER BY created_at ASC
  `;
  return NextResponse.json(users);
}

export async function PATCH(req) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, prayer_enabled } = await req.json();
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const [user] = await sql`
    UPDATE users
    SET prayer_enabled = ${prayer_enabled}
    WHERE id = ${userId}
    RETURNING id, email, prayer_enabled
  `;
  return NextResponse.json(user);
}
