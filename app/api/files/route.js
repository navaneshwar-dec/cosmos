import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { initDb } from '../../../lib/db';
import { listFolder, search, trashItem, renameItem, DriveNotConnected } from '../../../lib/drive';

// GET /api/files?folder=<id>   → list a folder (default: cosmos root)
// GET /api/files?q=<term>      → search cosmos files by name
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const folder = searchParams.get('folder');
  try {
    if (q && q.trim()) return NextResponse.json({ connected: true, results: await search(session.user.id, q.trim()) });
    const { parent, root, files } = await listFolder(session.user.id, folder || null);
    return NextResponse.json({ connected: true, parent, root, files });
  } catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false });
    console.error('[files] GET', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Drive error' }, { status: 500 });
  }
}

// DELETE /api/files?id=<fileId>  → move to Drive trash
export async function DELETE(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try { return NextResponse.json(await trashItem(session.user.id, id)); }
  catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false }, { status: 409 });
    return NextResponse.json({ error: e?.message ?? 'Delete error' }, { status: 500 });
  }
}

// PATCH /api/files  { id, name }  → rename
export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  try { return NextResponse.json(await renameItem(session.user.id, id, name.trim())); }
  catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false }, { status: 409 });
    return NextResponse.json({ error: e?.message ?? 'Rename error' }, { status: 500 });
  }
}
