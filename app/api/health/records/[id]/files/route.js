import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../auth';
import { createFolder, uploadFile, DriveNotConnected } from '../../../../../../lib/drive';

export const runtime = 'nodejs';

// the user's "Medical" Drive folder (created once, id cached on the user row)
async function medicalFolder(userId) {
  const [u] = await sql`SELECT drive_medical_id FROM users WHERE id = ${userId}`;
  if (u?.drive_medical_id) return u.drive_medical_id;
  const folder = await createFolder(userId, 'Medical', null);
  await sql`UPDATE users SET drive_medical_id = ${folder.id} WHERE id = ${userId}`;
  return folder.id;
}

export async function POST(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;
  await initDb();
  const rec = (await sql`SELECT id FROM health_records WHERE id = ${id} AND user_id = ${uid}`)[0];
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const parent = await medicalFolder(uid);
    const up = await uploadFile(uid, { name: file.name, mimeType: file.type || 'application/octet-stream', bytes, parentId: parent });
    const [row] = await sql`
      INSERT INTO health_files (user_id, record_id, drive_file_id, name, mime)
      VALUES (${uid}, ${id}, ${up.id}, ${up.name}, ${up.mimeType})
      RETURNING id, name, mime
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof DriveNotConnected) return NextResponse.json({ error: 'Connect Google Drive first (sign out and back in to grant access).' }, { status: 400 });
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
