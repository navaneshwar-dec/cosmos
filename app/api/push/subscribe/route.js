import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${session.user.id}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;

  return NextResponse.json({ ok: true });
}
