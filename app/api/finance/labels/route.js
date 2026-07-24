import { NextResponse } from 'next/server';
import db from '../../../../lib/financeDb';
import { auth } from '../../../../auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = db.prepare(
    'SELECT label, COUNT(*) as n FROM tx_labels WHERE user_id = ? GROUP BY label ORDER BY n DESC, label'
  ).all(session.user.id);
  return NextResponse.json(rows);
}
