import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';
import { istDateKey } from '../../../../lib/dates';
import { parseFood } from '../../../../lib/health/nutrition';

export const runtime = 'nodejs';

const sum = (items, k) => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const uid  = session.user.id;

  if (from && to) {
    const rows = await sql`
      SELECT * FROM food_logs
      WHERE user_id = ${uid} AND log_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY log_date DESC, created_at ASC
    `;
    return NextResponse.json(rows);
  }
  const rows = await sql`
    SELECT * FROM food_logs
    WHERE user_id = ${uid} AND log_date = ${date ?? istDateKey()}::date
    ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();

  const { raw_text, meal, log_date } = await req.json();
  if (!raw_text?.trim()) return NextResponse.json({ error: 'Nothing to log' }, { status: 400 });

  let items;
  try {
    items = await parseFood(raw_text.trim());
  } catch (e) {
    return NextResponse.json({ error: 'Could not estimate this meal: ' + (e?.message ?? e) }, { status: 502 });
  }
  if (!items.length) return NextResponse.json({ error: 'No food recognised — try rephrasing.' }, { status: 422 });

  const [row] = await sql`
    INSERT INTO food_logs (user_id, log_date, meal, raw_text, items, calories, protein, carbs, fat)
    VALUES (
      ${session.user.id},
      ${log_date || istDateKey()}::date,
      ${meal || null},
      ${raw_text.trim()},
      ${JSON.stringify(items)}::jsonb,
      ${sum(items, 'calories')}, ${sum(items, 'protein')}, ${sum(items, 'carbs')}, ${sum(items, 'fat')}
    )
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const id = new URL(req.url).searchParams.get('id');
  await sql`DELETE FROM food_logs WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
