import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  await initDb();

  const current = (await sql`SELECT * FROM work_items WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, notes, priority, deadline, assignee_id, completed, labels } = await req.json();

  await sql`
    UPDATE work_items SET
      title       = ${title       !== undefined ? (title?.trim() || current.title) : current.title},
      notes       = ${notes       !== undefined ? (notes ?? null)                  : current.notes},
      priority    = ${priority    !== undefined ? priority                         : current.priority},
      deadline    = ${deadline    !== undefined ? (deadline ?? null)               : current.deadline},
      assignee_id = ${assignee_id !== undefined ? (assignee_id ?? null)            : current.assignee_id},
      labels      = ${labels      !== undefined ? labels                           : current.labels},
      completed   = ${completed   !== undefined ? completed                        : current.completed}
    WHERE id = ${id} AND user_id = ${uid}
  `;

  const [full] = await sql`
    SELECT w.*, p.name AS assignee_name, p.color AS assignee_color
    FROM work_items w LEFT JOIN people p ON p.id = w.assignee_id
    WHERE w.id = ${id}
  `;
  return NextResponse.json(full);
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await initDb();
  await sql`DELETE FROM work_items WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
