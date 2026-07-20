import sql from './db';
import { istDateKey } from './dates';

// Read-only tools the in-app assistant can call over cosmos data.
// FINANCE IS INTENTIONALLY ABSENT — finance data must never reach a cloud model.

export const TOOL_DEFS = [
  {
    name: 'get_today',
    description: "The user's agenda for today: routines scheduled today (with done state), to-dos due today or overdue, and work items due today or marked P1. Use for 'what's on today', 'what's overdue', 'what should I focus on'.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_tasks',
    description: "List the user's personal to-do tasks.",
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'overdue', 'today', 'completed', 'all'], description: 'Which tasks to return (default pending)' },
        label:  { type: 'string', description: 'Only tasks carrying this label' },
      },
    },
  },
  {
    name: 'get_work',
    description: "List work / team-priority items (P1 highest … P4 lowest), with deadlines and assignees.",
    parameters: {
      type: 'object',
      properties: {
        status:   { type: 'string', enum: ['open', 'completed', 'all'], description: 'Default open' },
        priority: { type: 'integer', description: 'Filter to a single priority 1-4' },
      },
    },
  },
  {
    name: 'get_gym',
    description: "The user's recent workout logs (exercises done, sets, skips).",
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'How many past days to include (default 7)' } },
    },
  },
  {
    name: 'get_routine',
    description: "The user's daily routine definitions and whether each is done today.",
    parameters: { type: 'object', properties: {} },
  },
];

const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export async function executeTool(userId, name, args = {}) {
  const today = istDateKey();
  const todayDow = dow[new Date(today + 'T12:00:00Z').getUTCDay()];

  switch (name) {
    case 'get_today': {
      const tasks = await sql`
        SELECT text, date, labels FROM tasks
        WHERE user_id = ${userId} AND completed = false AND date IS NOT NULL
          AND date::date <= ${today}::date
        ORDER BY date ASC`;
      const work = await sql`
        SELECT w.title, w.priority, w.deadline, p.name AS assignee
        FROM work_items w LEFT JOIN people p ON p.id = w.assignee_id
        WHERE w.user_id = ${userId} AND w.completed = false
          AND (w.priority = 1 OR (w.deadline IS NOT NULL AND w.deadline::date <= ${today}::date))
        ORDER BY w.priority ASC, w.deadline ASC NULLS LAST`;
      const routines = await sql`
        SELECT r.title, r.time, (l.id IS NOT NULL) AS done
        FROM routines r
        LEFT JOIN routine_logs l ON l.routine_id = r.id AND l.user_id = r.user_id AND l.log_date = ${today}::date
        WHERE r.user_id = ${userId} AND r.archived = false
          AND (${todayDow} = ANY(r.days) OR cardinality(r.days) = 0)
        ORDER BY r.time ASC NULLS LAST`;
      return {
        date: today,
        routines: routines.map(r => ({ title: r.title, time: r.time, done: r.done })),
        todos: tasks.map(t => ({ text: t.text, due: t.date, overdue: t.date && new Date(t.date) < new Date(today + 'T00:00:00'), labels: t.labels })),
        work: work.map(w => ({ title: w.title, priority: `P${w.priority}`, deadline: w.deadline, assignee: w.assignee })),
      };
    }

    case 'get_tasks': {
      const status = args.status || 'pending';
      let rows = await sql`
        SELECT text, date, completed, recurrence, labels FROM tasks
        WHERE user_id = ${userId}
          ${status === 'completed' ? sql`AND completed = true`
            : status === 'all' ? sql``
            : sql`AND completed = false`}
          ${args.label ? sql`AND ${args.label} = ANY(labels)` : sql``}
        ORDER BY date ASC NULLS LAST`;
      if (status === 'overdue') rows = rows.filter(t => t.date && new Date(t.date) < new Date(today + 'T00:00:00'));
      if (status === 'today')   rows = rows.filter(t => t.date && String(t.date).slice(0, 10) === today);
      return { count: rows.length, tasks: rows.map(t => ({ text: t.text, due: t.date, done: t.completed, recurrence: t.recurrence, labels: t.labels })) };
    }

    case 'get_work': {
      const status = args.status || 'open';
      const rows = await sql`
        SELECT w.title, w.notes, w.priority, w.deadline, w.labels, w.completed, p.name AS assignee
        FROM work_items w LEFT JOIN people p ON p.id = w.assignee_id
        WHERE w.user_id = ${userId}
          ${status === 'completed' ? sql`AND w.completed = true`
            : status === 'all' ? sql``
            : sql`AND w.completed = false`}
          ${args.priority ? sql`AND w.priority = ${args.priority}` : sql``}
        ORDER BY w.priority ASC, w.deadline ASC NULLS LAST`;
      return { count: rows.length, items: rows.map(w => ({ title: w.title, priority: `P${w.priority}`, deadline: w.deadline, assignee: w.assignee, labels: w.labels, notes: w.notes, done: w.completed })) };
    }

    case 'get_gym': {
      const days = Math.min(Math.max(args.days || 7, 1), 60);
      const rows = await sql`
        SELECT log_date, day, exercise, sets, skipped, skip_reason FROM workout_logs
        WHERE user_id = ${userId} AND log_date >= (${today}::date - ${days}::int)
        ORDER BY log_date DESC, created_at ASC`;
      return { days, count: rows.length, logs: rows.map(r => ({ date: r.log_date, day: r.day, exercise: r.exercise, sets: r.sets, skipped: r.skipped, skip_reason: r.skip_reason })) };
    }

    case 'get_routine': {
      const rows = await sql`
        SELECT r.title, r.time, r.days, (l.id IS NOT NULL) AS done_today
        FROM routines r
        LEFT JOIN routine_logs l ON l.routine_id = r.id AND l.user_id = r.user_id AND l.log_date = ${today}::date
        WHERE r.user_id = ${userId} AND r.archived = false
        ORDER BY r.time ASC NULLS LAST`;
      return { routines: rows.map(r => ({ title: r.title, time: r.time, days: r.days, done_today: r.done_today })) };
    }

    default:
      return { error: `unknown tool ${name}` };
  }
}
