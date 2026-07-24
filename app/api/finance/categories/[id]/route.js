import { NextResponse } from 'next/server';
import db from '../../../../../lib/financeDb';
import { auth } from '../../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  const current = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.is_default) return NextResponse.json({ error: 'Default categories can\'t be renamed' }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    db.prepare('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?').run(name.trim(), id, userId);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 });
  }
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  const current = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.is_default) return NextResponse.json({ error: 'Default categories can\'t be deleted' }, { status: 403 });

  // the category plus any of its subcategories all go away together
  const children = db.prepare('SELECT id FROM categories WHERE user_id = ? AND parent_id = ?').all(userId, id).map(c => c.id);
  const ids = [current.id, ...children];
  const placeholders = ids.map(() => '?').join(',');

  const run = db.transaction(() => {
    // transactions using any of these categories become uncategorized (never orphan-referenced)
    const untagged = db.prepare(
      `UPDATE transactions SET category_id = NULL WHERE user_id = ? AND category_id IN (${placeholders})`
    ).run(userId, ...ids).changes;
    db.prepare(`DELETE FROM merchant_rules WHERE user_id = ? AND category_id IN (${placeholders})`).run(userId, ...ids);
    db.prepare(`DELETE FROM categories WHERE user_id = ? AND id IN (${placeholders})`).run(userId, ...ids);
    return untagged;
  });
  const untagged = run();

  return NextResponse.json({ deleted: ids.length, subcategoriesDeleted: children.length, transactionsUntagged: untagged });
}
