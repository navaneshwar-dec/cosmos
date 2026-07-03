import { NextResponse } from 'next/server';
import db, { ensureUserSeeded } from '../../../../lib/financeDb';
import { auth } from '../../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  ensureUserSeeded(session.user.id);
  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY parent_id IS NOT NULL, name').all(session.user.id);
  return NextResponse.json(categories);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, parentId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  ensureUserSeeded(session.user.id);
  try {
    const result = db.prepare('INSERT INTO categories (user_id, name, parent_id) VALUES (?, ?, ?)')
      .run(session.user.id, name.trim(), parentId ?? null);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
  }
}
