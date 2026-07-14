import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

// The server never sees the master password or plaintext — only the salt and
// verifier blobs, which are useless without the user's master password.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const [row] = await sql`SELECT salt, verifier_iv, verifier_ct FROM vault_meta WHERE user_id = ${session.user.id}`;
  if (!row) return NextResponse.json({ exists: false });
  return NextResponse.json({ exists: true, salt: row.salt, verifier_iv: row.verifier_iv, verifier_ct: row.verifier_ct });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const uid = session.user.id;

  const existing = (await sql`SELECT 1 FROM vault_meta WHERE user_id = ${uid}`)[0];
  if (existing) return NextResponse.json({ error: 'Vault already exists' }, { status: 409 });

  const { salt, verifier_iv, verifier_ct } = await req.json();
  if (!salt || !verifier_iv || !verifier_ct) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await sql`
    INSERT INTO vault_meta (user_id, salt, verifier_iv, verifier_ct)
    VALUES (${uid}, ${salt}, ${verifier_iv}, ${verifier_ct})
  `;
  return NextResponse.json({ ok: true }, { status: 201 });
}
