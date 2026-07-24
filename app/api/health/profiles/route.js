import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

const COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#0d9488', '#ec4899'];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const rows = await sql`
    SELECT p.*, (SELECT COUNT(*) FROM health_records r WHERE r.profile_id = p.id) AS record_count
    FROM health_profiles p WHERE p.user_id = ${session.user.id}
    ORDER BY p.sort_order, p.created_at
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, relation, dob, blood_group, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  await initDb();
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM health_profiles WHERE user_id = ${session.user.id}`;
  const [row] = await sql`
    INSERT INTO health_profiles (user_id, name, relation, dob, blood_group, notes, color, sort_order)
    VALUES (${session.user.id}, ${name.trim()}, ${relation ?? null}, ${dob || null}, ${blood_group ?? null}, ${notes ?? null}, ${COLORS[n % COLORS.length]}, ${n})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
