import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';

export const runtime = 'nodejs';

async function readGoals(uid) {
  const [g] = await sql`SELECT calories, protein, carbs, fat FROM nutrition_goals WHERE user_id = ${uid}`;
  if (g) return g;
  // seed sensible defaults on first read so the dashboard always has target lines
  const [seeded] = await sql`
    INSERT INTO nutrition_goals (user_id) VALUES (${uid})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING calories, protein, carbs, fat
  `;
  return seeded ?? { calories: 2000, protein: 120, carbs: 220, fat: 60 };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  return NextResponse.json(await readGoals(session.user.id));
}

export async function PUT(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const { calories, protein, carbs, fat } = await req.json();
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  const [g] = await sql`
    INSERT INTO nutrition_goals (user_id, calories, protein, carbs, fat, updated_at)
    VALUES (${session.user.id}, ${n(calories, 2000)}, ${n(protein, 120)}, ${n(carbs, 220)}, ${n(fat, 60)}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      calories = EXCLUDED.calories, protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs, fat = EXCLUDED.fat, updated_at = NOW()
    RETURNING calories, protein, carbs, fat
  `;
  return NextResponse.json(g);
}
