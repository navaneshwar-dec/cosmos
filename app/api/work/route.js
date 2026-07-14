import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const items = await sql`
    SELECT w.*, p.name AS assignee_name, p.color AS assignee_color
    FROM work_items w
    LEFT JOIN people p ON p.id = w.assignee_id
    WHERE w.user_id = ${session.user.id}
    ORDER BY w.created_at ASC
  `;
  return NextResponse.json(items);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { title, priority, deadline, assignee_id, notes, labels } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const [item] = await sql`
    INSERT INTO work_items (user_id, title, priority, deadline, assignee_id, notes, labels)
    VALUES (
      ${session.user.id},
      ${title.trim()},
      ${priority ?? 2},
      ${deadline ?? null},
      ${assignee_id ?? null},
      ${notes ?? null},
      ${labels ?? []}
    )
    RETURNING *
  `;
  const [full] = await sql`
    SELECT w.*, p.name AS assignee_name, p.color AS assignee_color
    FROM work_items w LEFT JOIN people p ON p.id = w.assignee_id
    WHERE w.id = ${item.id}
  `;
  return NextResponse.json(full, { status: 201 });
}
