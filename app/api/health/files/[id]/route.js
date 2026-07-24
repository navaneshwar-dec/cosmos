import { NextResponse } from 'next/server';
import sql from '../../../../../lib/db';
import { auth } from '../../../../../auth';
import { downloadFile } from '../../../../../lib/drive';

export const runtime = 'nodejs';

// stream the attachment back through cosmos (inline so PDFs/images open in the browser)
export async function GET(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const f = (await sql`SELECT * FROM health_files WHERE id = ${id} AND user_id = ${session.user.id}`)[0];
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const { meta, body } = await downloadFile(session.user.id, f.drive_file_id);
    return new Response(body, {
      headers: {
        'Content-Type': meta.mimeType || f.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${(f.name || meta.name || 'file').replace(/"/g, '')}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Download failed' }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  // remove the ref only; the file stays in the user's Drive
  await sql`DELETE FROM health_files WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
