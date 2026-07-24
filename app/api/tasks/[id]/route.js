import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';
import { auth } from '../../../../auth';
import { getNextOccurrence } from '../../../../lib/recurrence';

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  const body = await req.json();

  // Toggle completed only
  if ('completed' in body && Object.keys(body).length === 1) {
    const rows = await sql`
      UPDATE tasks SET completed = ${body.completed}
      WHERE id = ${id} AND user_id = ${uid}
      RETURNING *
    `;
    const task = rows[0];
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Sub-item cascade: toggling a parent sets all its sub-items; toggling a sub-item
    // recomputes the parent (done only when every sub-item is done).
    let affected = [];
    const kids = await sql`UPDATE tasks SET completed = ${body.completed} WHERE parent_id = ${id} AND user_id = ${uid} RETURNING *`;
    if (kids.length) affected = affected.concat(kids);
    if (task.parent_id) {
      const sibs = await sql`SELECT completed FROM tasks WHERE parent_id = ${task.parent_id} AND user_id = ${uid}`;
      const allDone = sibs.length > 0 && sibs.every(s => s.completed);
      const p = await sql`UPDATE tasks SET completed = ${allDone} WHERE id = ${task.parent_id} AND user_id = ${uid} RETURNING *`;
      if (p[0]) affected.push(p[0]);
    }

    let next = null;
    if (body.completed && task.recurrence && !task.parent_id) {
      const nextDate = getNextOccurrence(task.recurrence, task.date);
      const inserted = await sql`
        INSERT INTO tasks (user_id, text, date, recurrence, labels)
        VALUES (${uid}, ${task.text}, ${nextDate}, ${task.recurrence}, ${task.labels})
        RETURNING *
      `;
      next = inserted[0];
    }
    return NextResponse.json({ task, next, affected });
  }

  // Full edit — fetch current first so unspecified fields keep their value
  const current = (await sql`SELECT * FROM tasks WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { text, date, recurrence, labels } = body;
  const rows = await sql`
    UPDATE tasks SET
      text       = ${text       !== undefined ? (text ?? current.text)             : current.text},
      date       = ${date       !== undefined ? (date ?? null)                     : current.date},
      recurrence = ${recurrence !== undefined ? (recurrence ?? null)               : current.recurrence},
      labels     = ${labels     !== undefined ? labels                             : current.labels}
    WHERE id = ${id} AND user_id = ${uid}
    RETURNING *
  `;
  return NextResponse.json({ task: rows[0], next: null });
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // remove the task and any of its sub-items
  await sql`DELETE FROM tasks WHERE (id = ${id} OR parent_id = ${id}) AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
