import { NextResponse } from 'next/server';
import db from '../../../../../../lib/financeDb';
import { auth } from '../../../../../../auth';

function labelsFor(userId, txnId) {
  return db.prepare('SELECT label FROM tx_labels WHERE user_id = ? AND transaction_id = ? ORDER BY label')
    .all(userId, txnId).map(r => r.label);
}

async function ownTxn(userId, id) {
  return db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
}

export async function POST(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  if (!(await ownTxn(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { label } = await req.json();
  const clean = String(label ?? '').trim().slice(0, 40);
  if (!clean) return NextResponse.json({ error: 'Label is required' }, { status: 400 });

  db.prepare('INSERT OR IGNORE INTO tx_labels (user_id, transaction_id, label) VALUES (?, ?, ?)').run(userId, id, clean);
  return NextResponse.json({ labels: labelsFor(userId, id) }, { status: 201 });
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  if (!(await ownTxn(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { label } = await req.json();
  db.prepare('DELETE FROM tx_labels WHERE user_id = ? AND transaction_id = ? AND label = ?').run(userId, id, label);
  return NextResponse.json({ labels: labelsFor(userId, id) });
}
