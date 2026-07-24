import * as XLSX from 'xlsx';
import { decryptOffice } from '../decrypt';

// Processor for SBI savings-account statements (password-protected .xlsx).
// Layout: metadata rows, then a header "Date | Details | Ref No/Cheque No | Debit | Credit | Balance",
// dates DD/MM/YYYY, debit = money out (spend), credit = money in, plus a running balance.
export const meta = { id: 'sbi', label: 'SBI — Savings', accountType: 'bank_account', encrypted: true };

function toISO(s) {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null; // DD/MM/YYYY → YYYY-MM-DD
}
function num(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[,\s]/g, ''));
  return isNaN(n) ? null : n;
}

export async function parse(buffer, { password } = {}) {
  const decrypted = await decryptOffice(buffer, password);
  const wb = XLSX.read(decrypted, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });

  let hi = -1;
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].map(c => String(c).toLowerCase()).join('|');
    if (/date/.test(j) && /debit/.test(j) && /credit/.test(j)) { hi = i; break; }
  }
  if (hi < 0) return { transactions: [], skipped: 0, error: 'SBI header row not found' };

  const H = rows[hi].map(c => String(c).trim().toLowerCase());
  const di = H.indexOf('date');
  const dei = H.findIndex(c => c.includes('detail'));
  const ri = H.findIndex(c => c.includes('ref'));
  const dbi = H.indexOf('debit');
  const cri = H.indexOf('credit');
  const bi = H.indexOf('balance');

  const transactions = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const date = toISO(r[di]);
    if (!date) { skipped++; continue; }               // footer / blank rows have no valid date → stop counting them
    const description = String(r[dei] ?? '').replace(/\s+/g, ' ').trim();
    const debit = num(r[dbi]);
    const credit = num(r[cri]);
    let amount = null;
    if (debit) amount = -Math.abs(debit);             // withdrawal → spend (negative)
    else if (credit) amount = Math.abs(credit);       // deposit → income (positive)
    if (amount === null || amount === 0) { skipped++; continue; }

    const refNo = String(r[ri] ?? '').trim();
    const balance = String(r[bi] ?? '').trim();
    // stable dedup key: the bank ref when present, else date+running-balance (unique per row)
    const ref = refNo || `${date}|${balance}|${amount}`;
    transactions.push({ date, description, amount, ref });
  }
  return { transactions, skipped };
}
