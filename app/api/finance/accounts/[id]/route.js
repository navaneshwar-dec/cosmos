import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';
import { encryptSecret } from '../../../../../lib/financeCrypto';
import { publicAccount } from '../route';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const current = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, session.user.id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name, type, issuer, last4, color, password } = await req.json();
  db.prepare('UPDATE accounts SET name = ?, type = ?, issuer = ?, last4 = ?, color = ?, password_enc = ? WHERE id = ? AND user_id = ?').run(
    name?.trim() ?? current.name,
    ['credit_card', 'bank_account'].includes(type) ? type : current.type,
    issuer !== undefined ? issuer?.trim() ?? null : current.issuer,
    last4 !== undefined ? last4?.trim() ?? null : current.last4,
    color !== undefined ? color : current.color,
    // only replace the password when a new one is provided; blank string clears it
    password === undefined ? current.password_enc : (password ? encryptSecret(password) : null),
    id, session.user.id
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return NextResponse.json(publicAccount(account));
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const current = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(id, session.user.id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE account_id = ? AND user_id = ?').run(id, session.user.id);
    db.prepare('DELETE FROM statements WHERE account_id = ? AND user_id = ?').run(id, session.user.id);
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, session.user.id);
  });
  tx();

  return NextResponse.json({ ok: true });
}
