import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });
  await initDb();
  const rows = await sql`
    SELECT r.*,
      COALESCE(json_agg(json_build_object('id', f.id, 'name', f.name, 'mime', f.mime))
               FILTER (WHERE f.id IS NOT NULL), '[]') AS files
    FROM health_records r
    LEFT JOIN health_files f ON f.record_id = r.id
    WHERE r.user_id = ${session.user.id} AND r.profile_id = ${profileId}
    GROUP BY r.id
    ORDER BY r.date DESC NULLS LAST, r.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { profileId, kind, date, title, doctor, place, details } = await req.json();
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  await initDb();
  const owns = (await sql`SELECT id FROM health_profiles WHERE id = ${profileId} AND user_id = ${session.user.id}`)[0];
  if (!owns) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
  const [row] = await sql`
    INSERT INTO health_records (user_id, profile_id, kind, date, title, doctor, place, details)
    VALUES (${session.user.id}, ${profileId}, ${kind || 'visit'}, ${date || null}, ${title.trim()}, ${doctor ?? null}, ${place ?? null}, ${details ?? null})
    RETURNING *
  `;
  return NextResponse.json({ ...row, files: [] }, { status: 201 });
}
