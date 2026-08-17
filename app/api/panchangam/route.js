import { NextResponse } from 'next/server';
import { todaysPanchangam } from '../../../lib/panchangam';

export const runtime = 'nodejs';

// Today's Hindu almanac — computed on the fly, so it's always current-day (updates daily).
export async function GET(req) {
  try {
    const date = new URL(req.url).searchParams.get('date') || undefined;
    return NextResponse.json(todaysPanchangam(date));
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? 'panchangam failed' }, { status: 500 });
  }
}
