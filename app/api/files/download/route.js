import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { initDb } from '../../../../lib/db';
import { downloadFile, DriveNotConnected } from '../../../../lib/drive';

export const runtime = 'nodejs';

// GET /api/files/download?id=<fileId>  → stream the file back with an attachment header
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initDb();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const { meta, body } = await downloadFile(session.user.id, id);
    const headers = new Headers();
    headers.set('Content-Type', meta.mimeType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.name || 'download')}"`);
    if (meta.size) headers.set('Content-Length', String(meta.size));
    return new Response(body, { headers });
  } catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ connected: false }, { status: 409 });
    console.error('[files] download', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Download error' }, { status: 500 });
  }
}
