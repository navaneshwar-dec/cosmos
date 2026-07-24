import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

// Persist a manual order: body { ids: [id, id, ...] } → sort_order = position (1-based).
// Only the caller's own rows are touched.
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids } = await req.json();
  const clean = Array.isArray(ids) ? ids.filter(n => Number.isInteger(n)) : [];
  if (clean.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });

  await initDb();
  await sql`
    UPDATE work_items AS w SET sort_order = v.ord
    FROM unnest(${clean}::int[]) WITH ORDINALITY AS v(id, ord)
    WHERE w.id = v.id AND w.user_id = ${session.user.id}
  `;
  return NextResponse.json({ ok: true });
}
