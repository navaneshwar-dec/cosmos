import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { initDb } from '../../../../lib/db';
import { uploadFile, DriveNotConnected } from '../../../../lib/drive';

export const runtime = 'nodejs';

// POST /api/files/upload  (multipart form: file, parent)  → upload one file to Drive
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();

  let form;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Expected multipart form-data' }, { status: 400 }); }

  const file   = form.get('file');
  const parent = form.get('parent');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file required' }, { status: 400 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const row = await uploadFile(session.user.id, {
      name: file.name || 'untitled',
      mimeType: file.type || 'application/octet-stream',
      bytes,
      parentId: parent || null,
    });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false }, { status: 409 });
    console.error('[files] upload', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Upload error' }, { status: 500 });
  }
}
