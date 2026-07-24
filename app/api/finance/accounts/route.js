import { NextResponse } from 'next/server';
import db, { ensureUserSeeded } from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { encryptSecret } from '../../../../lib/financeCrypto';

// Never send the encrypted password to the client — expose only booleans.
export function publicAccount(a) {
  if (!a) return a;
  const { password_enc, processor, ...rest } = a;
  return { ...rest, has_password: !!password_enc, has_sample: !!a.sample_filename, has_processor: !!processor };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  ensureUserSeeded(session.user.id);
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC').all(session.user.id);
  return NextResponse.json(accounts.map(publicAccount));
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, type, issuer, last4, color, password } = await req.json();
  if (!name?.trim() || !['credit_card', 'bank_account'].includes(type)) {
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
  }

  ensureUserSeeded(session.user.id);
  const result = db.prepare(
    'INSERT INTO accounts (user_id, name, type, issuer, last4, color, password_enc) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    session.user.id, name.trim(), type, issuer?.trim() ?? null, last4?.trim() ?? null, color ?? null,
    password ? encryptSecret(password) : null
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(publicAccount(account), { status: 201 });
}
