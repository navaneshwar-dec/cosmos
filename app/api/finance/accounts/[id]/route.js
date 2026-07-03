import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const current = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, session.user.id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name, issuer, last4, color } = await req.json();
  db.prepare('UPDATE accounts SET name = ?, issuer = ?, last4 = ?, color = ? WHERE id = ? AND user_id = ?').run(
    name?.trim() ?? current.name,
    issuer !== undefined ? issuer?.trim() ?? null : current.issuer,
    last4 !== undefined ? last4?.trim() ?? null : current.last4,
    color !== undefined ? color : current.color,
    id, session.user.id
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return NextResponse.json(account);
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
