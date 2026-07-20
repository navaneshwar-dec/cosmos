import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { auth } from '../../../auth';

// GET /api/diary                → all entries (date, mood, body) newest first
// GET /api/diary?date=YYYY-MM-DD → single entry for that day (or null)
// GET /api/diary?q=term          → entries whose body matches (case-insensitive)
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const q    = searchParams.get('q');
  const uid  = session.user.id;

  if (date) {
    const [row] = await sql`
      SELECT id, entry_date, mood, body, updated_at
      FROM diary_entries WHERE user_id = ${uid} AND entry_date = ${date}::date
    `;
    return NextResponse.json(row ?? null);
  }

  if (q && q.trim()) {
    const rows = await sql`
      SELECT id, entry_date, mood, body, updated_at
      FROM diary_entries
      WHERE user_id = ${uid} AND body ILIKE ${'%' + q.trim() + '%'}
      ORDER BY entry_date DESC
    `;
    return NextResponse.json(rows);
  }

  const rows = await sql`
    SELECT id, entry_date, mood, body, updated_at
    FROM diary_entries WHERE user_id = ${uid}
    ORDER BY entry_date DESC
  `;
  return NextResponse.json(rows);
}

// POST /api/diary  { entry_date, mood, body } → upsert the day's entry
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { entry_date, mood, body } = await req.json();
  const uid = session.user.id;
  if (!entry_date) return NextResponse.json({ error: 'entry_date required' }, { status: 400 });

  const [row] = await sql`
    INSERT INTO diary_entries (user_id, entry_date, mood, body)
    VALUES (${uid}, ${entry_date}::date, ${mood ?? null}, ${body ?? ''})
    ON CONFLICT (user_id, entry_date) DO UPDATE SET
      mood       = EXCLUDED.mood,
      body       = EXCLUDED.body,
      updated_at = NOW()
    RETURNING id, entry_date, mood, body, updated_at
  `;
  return NextResponse.json(row);
}

// DELETE /api/diary?date=YYYY-MM-DD
export async function DELETE(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  await sql`DELETE FROM diary_entries WHERE user_id = ${session.user.id} AND entry_date = ${date}::date`;
  return NextResponse.json({ ok: true });
}
