import { NextResponse } from 'next/server';
import sql from '../../../lib/db';

async function initGymLinks() {
  await sql`
    CREATE TABLE IF NOT EXISTS gym_links (
      id         SERIAL PRIMARY KEY,
      day        TEXT NOT NULL,
      exercise   TEXT NOT NULL,
      yt         TEXT,
      short      TEXT,
      short_note TEXT,
      UNIQUE(day, exercise)
    )
  `;
}

let ready = false;
async function ensure() {
  if (ready) return;
  await initGymLinks();
  ready = true;
}

export async function GET() {
  await ensure();
  const rows = await sql`SELECT * FROM gym_links`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  await ensure();
  const { day, exercise, yt, short, short_note } = await req.json();
  const [row] = await sql`
    INSERT INTO gym_links (day, exercise, yt, short, short_note)
    VALUES (${day}, ${exercise}, ${yt ?? null}, ${short ?? null}, ${short_note ?? null})
    ON CONFLICT (day, exercise) DO UPDATE SET
      yt         = EXCLUDED.yt,
      short      = EXCLUDED.short,
      short_note = EXCLUDED.short_note
    RETURNING *
  `;
  return NextResponse.json(row);
}
