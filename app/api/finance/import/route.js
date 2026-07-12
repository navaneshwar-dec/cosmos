import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';
import { parseWorkbook, guessColumnMapping, mappingIsValid } from '../../../../lib/statementParser';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const accountId = formData.get('accountId');
  if (!file || !accountId) return NextResponse.json({ error: 'Missing file or account' }, { status: 400 });

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, session.user.id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  let headers, rows, headerRowConfident;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    ({ headers, rows, headerRowConfident } = parseWorkbook(buffer));
  } catch (err) {
    return NextResponse.json({ error: 'Could not read file: ' + (err?.message ?? err) }, { status: 400 });
  }
  if (!headers.length) return NextResponse.json({ error: 'No columns found in file' }, { status: 400 });

  const issuerKey = (account.issuer || account.name).trim().toLowerCase();
  const savedRow = db.prepare('SELECT column_map FROM import_mappings WHERE user_id = ? AND issuer = ?').get(session.user.id, issuerKey);
  const savedMapping = savedRow ? JSON.parse(savedRow.column_map) : null;
  const mapping = savedMapping && mappingIsValid(savedMapping, headers) ? savedMapping : guessColumnMapping(headers);

  return NextResponse.json({
    headers,
    previewRows: rows.slice(0, 8),
    totalRows: rows.length,
    mapping,
    mappingSource: savedMapping && mappingIsValid(savedMapping, headers) ? 'saved' : 'guessed',
    headerRowConfident,
  });
}
