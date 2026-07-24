import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const tasks = await sql`
    SELECT * FROM tasks
    WHERE user_id = ${session.user.id}
    ORDER BY date ASC NULLS LAST, created_at ASC
  `;
  return NextResponse.json(tasks);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { text, date, recurrence, labels, parentId } = await req.json();
  const [task] = await sql`
    INSERT INTO tasks (user_id, text, date, recurrence, labels, parent_id)
    VALUES (${session.user.id}, ${text}, ${date ?? null}, ${recurrence ?? null}, ${labels ?? []}, ${parentId ?? null})
    RETURNING *
  `;
  // adding an open sub-item re-opens its parent
  if (parentId) await sql`UPDATE tasks SET completed = FALSE WHERE id = ${parentId} AND user_id = ${session.user.id}`;
  return NextResponse.json(task, { status: 201 });
}
