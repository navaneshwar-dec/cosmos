import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { initDb } from '../../../../lib/db';
import { createFolder, DriveNotConnected } from '../../../../lib/drive';

// POST /api/files/folder  { name, parent }  → create a folder
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const { name, parent } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  try { return NextResponse.json(await createFolder(session.user.id, name.trim(), parent || null)); }
  catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false }, { status: 409 });
    return NextResponse.json({ error: e?.message ?? 'Create folder error' }, { status: 500 });
  }
}
