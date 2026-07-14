import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const uid = session.user.id;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekday = WD[new Date(date + 'T00:00:00').getDay()];

  // Routines scheduled for this weekday (empty days = every day), with today's done state
  const routineRows = await sql`
    SELECT r.id, r.title, r.time, r.days,
           (l.id IS NOT NULL) AS done
    FROM routines r
    LEFT JOIN routine_logs l ON l.routine_id = r.id AND l.user_id = r.user_id AND l.log_date = ${date}::date
    WHERE r.user_id = ${uid} AND r.archived = false
      AND (cardinality(r.days) = 0 OR ${weekday} = ANY(r.days))
    ORDER BY r.time ASC NULLS LAST, r.sort_order ASC
  `;
  const routines = routineRows.map(r => ({ type: 'routine', id: r.id, title: r.title, time: r.time, done: r.done }));

  // Incomplete dated tasks (client filters to today/overdue via its local clock)
  const taskRows = await sql`
    SELECT id, text, date FROM tasks
    WHERE user_id = ${uid} AND completed = false AND date IS NOT NULL
  `;
  const tasks = taskRows.map(t => ({ type: 'todo', id: t.id, title: t.text, date: t.date }));

  // Incomplete work items (client keeps P1 or due-today/overdue)
  const workRows = await sql`
    SELECT id, title, deadline, priority FROM work_items
    WHERE user_id = ${uid} AND completed = false
  `;
  const work = workRows.map(w => ({ type: 'work', id: w.id, title: w.title, deadline: w.deadline, priority: w.priority }));

  return NextResponse.json({ date, items: [...routines, ...tasks, ...work] });
}
