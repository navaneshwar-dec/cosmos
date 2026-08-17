import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../lib/db';
import { auth } from '../../../../auth';
import { istDateKey } from '../../../../lib/dates';
import { estimateBurn } from '../../../../lib/health/nutrition';

export const runtime = 'nodejs';

// Consumed (food) vs burned (workouts) for a single day, plus goals and the underlying rows.
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const uid  = session.user.id;
  const date = new URL(req.url).searchParams.get('date') || istDateKey();

  const meals = await sql`
    SELECT * FROM food_logs WHERE user_id = ${uid} AND log_date = ${date}::date ORDER BY created_at ASC
  `;

  // workouts done that day; backfill Gemini burn estimates for any not yet estimated
  const workouts = await sql`
    SELECT id, exercise, sets, skipped, calories_burned
    FROM workout_logs WHERE user_id = ${uid} AND log_date = ${date}::date AND skipped = FALSE
    ORDER BY created_at ASC
  `;
  for (const w of workouts) {
    if (w.calories_burned == null) {
      try {
        const kcal = await estimateBurn({ exercise: w.exercise, sets: w.sets, day: null });
        await sql`UPDATE workout_logs SET calories_burned = ${kcal} WHERE id = ${w.id}`;
        w.calories_burned = kcal;
      } catch {
        w.calories_burned = 0; // estimation failed (e.g. no Gemini key) — don't block the dashboard
      }
    }
  }

  const [goals] = await sql`SELECT calories, protein, carbs, fat FROM nutrition_goals WHERE user_id = ${uid}`;
  const g = goals ?? { calories: 2000, protein: 120, carbs: 220, fat: 60 };

  const consumed = meals.reduce((a, m) => ({
    calories: a.calories + Number(m.calories || 0),
    protein:  a.protein  + Number(m.protein  || 0),
    carbs:    a.carbs    + Number(m.carbs    || 0),
    fat:      a.fat      + Number(m.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const burned = workouts.reduce((s, w) => s + Number(w.calories_burned || 0), 0);

  return NextResponse.json({
    date,
    goals: g,
    consumed,
    burned,
    net: consumed.calories - burned,      // net intake vs expenditure
    meals,
    workouts: workouts.map(w => ({ id: w.id, exercise: w.exercise, calories_burned: w.calories_burned })),
  });
}
