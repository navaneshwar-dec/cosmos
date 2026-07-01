import { NextResponse } from 'next/server';
import sql from '../../../lib/db';

export async function GET() {
  try {
    const rows   = await sql`SELECT current_database(), current_user`;
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    return NextResponse.json({ ok: true, db: rows[0], tables: tables.map(r => r.tablename) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 500 });
  }
}
