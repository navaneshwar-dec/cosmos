import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';
import { requireAssistantKey } from '../../../../lib/assistantAuth';

export async function GET(req) {
  const userId = await requireAssistantKey(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await sql`
    SELECT text, date, completed, recurrence, labels
    FROM tasks
    WHERE user_id = ${userId} AND completed = false
    ORDER BY date ASC NULLS LAST, created_at ASC
  `;
  return NextResponse.json(tasks);
}
