import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  const current = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { categoryId, notes, rememberMerchant } = await req.json();

  if (categoryId !== undefined) {
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId);
    if (categoryId !== null && !category) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  db.prepare('UPDATE transactions SET category_id = ?, notes = ? WHERE id = ? AND user_id = ?').run(
    categoryId !== undefined ? categoryId : current.category_id,
    notes !== undefined ? notes : current.notes,
    id, userId
  );

  let bulkApplied = 0;
  if (rememberMerchant && categoryId && current.merchant_key) {
    db.prepare(`
      INSERT INTO merchant_rules (user_id, merchant_key, category_id) VALUES (?, ?, ?)
      ON CONFLICT(user_id, merchant_key) DO UPDATE SET category_id = excluded.category_id
    `).run(userId, current.merchant_key, categoryId);

    const result = db.prepare(
      'UPDATE transactions SET category_id = ? WHERE user_id = ? AND merchant_key = ? AND category_id IS NULL AND id != ?'
    ).run(categoryId, userId, current.merchant_key, id);
    bulkApplied = result.changes;
  }

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  return NextResponse.json({ transaction, bulkApplied });
}
