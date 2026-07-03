import { NextResponse } from 'next/server';
import db, { ensureUserSeeded } from '../../../../lib/financeDb';
import { auth } from '../../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  ensureUserSeeded(session.user.id);
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC').all(session.user.id);
  return NextResponse.json(accounts);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, type, issuer, last4, color } = await req.json();
  if (!name?.trim() || !['credit_card', 'bank_account'].includes(type)) {
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
  }

  ensureUserSeeded(session.user.id);
  const result = db.prepare(
    'INSERT INTO accounts (user_id, name, type, issuer, last4, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(session.user.id, name.trim(), type, issuer?.trim() ?? null, last4?.trim() ?? null, color ?? null);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(account, { status: 201 });
}
