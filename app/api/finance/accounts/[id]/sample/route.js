import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '../../../../../../lib/financeDb';
import { auth } from '../../../../../../auth';

export const runtime = 'nodejs';

const SAMPLE_DIR = path.join(process.cwd(), 'data', 'samples');

// Deterministic on-disk path for a source's sample (one sample per source, overwritten on replace).
export function samplePath(accountId, filename) {
  const ext = (path.extname(filename || '') || '.bin').slice(0, 8);
  return path.join(SAMPLE_DIR, `acct_${accountId}${ext}`);
}

// POST multipart { file } → store the sample template for this source (kept encrypted-at-rest? no —
// it's the raw statement; still password-protected until parsed. Lives only on the local Mac.)
export async function POST(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(id, session.user.id);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file required' }, { status: 400 });

  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  // clear any prior sample of a different extension
  for (const f of fs.readdirSync(SAMPLE_DIR)) {
    if (f.startsWith(`acct_${id}.`) || f === `acct_${id}`) fs.rmSync(path.join(SAMPLE_DIR, f), { force: true });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(samplePath(id, file.name), bytes);
  db.prepare('UPDATE accounts SET sample_filename = ? WHERE id = ? AND user_id = ?').run(file.name || 'sample', id, session.user.id);

  return NextResponse.json({ ok: true, sample_filename: file.name });
}

export async function DELETE(_, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const account = db.prepare('SELECT sample_filename FROM accounts WHERE id = ? AND user_id = ?').get(id, session.user.id);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  for (const f of fs.readdirSync(SAMPLE_DIR)) {
    if (f.startsWith(`acct_${id}.`) || f === `acct_${id}`) fs.rmSync(path.join(SAMPLE_DIR, f), { force: true });
  }
  db.prepare('UPDATE accounts SET sample_filename = NULL WHERE id = ? AND user_id = ?').run(id, session.user.id);
  return NextResponse.json({ ok: true });
}
