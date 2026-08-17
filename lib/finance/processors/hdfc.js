import * as XLSX from 'xlsx';
import { decryptOffice } from '../decrypt';

// Processor for HDFC Bank account statements (.xls / .xlsx, plain or password-protected).
// Layout: bank letterhead + account metadata rows, an asterisk separator, then a header
// "Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance",
// dates DD/MM/YY, Withdrawal = money out (spend), Deposit = money in, plus a running balance.
export const meta = { id: 'hdfc', label: 'HDFC — Bank', accountType: 'bank_account', encrypted: false };

function toISO(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // DD/MM/YY or DD/MM/YYYY
  if (!m) return null;
  const yy = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${yy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function num(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[,\s]/g, ''));
  return isNaN(n) ? null : n;
}

// HDFC statements download as a plain OLE .xls (0xD0CF) — not a ZIP — so decryptOffice would
// wrongly demand a password. Read the raw buffer first; only fall back to decrypt (with the
// source password) when a direct read yields no recognizable HDFC sheet.
function findHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].map(c => String(c).toLowerCase()).join('|');
    if (/date/.test(j) && /narration/.test(j) && (/withdrawal/.test(j) || /deposit/.test(j))) return i;
  }
  return -1;
}

export async function parse(buffer, { password } = {}) {
  let rows = null;
  let hi = -1;
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    hi = findHeader(rows);
  } catch { /* likely encrypted — fall through to decrypt */ }

  if (hi < 0) {
    const decrypted = await decryptOffice(buffer, password);
    const wb = XLSX.read(decrypted, { type: 'buffer' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    hi = findHeader(rows);
  }
  if (hi < 0) return { transactions: [], skipped: 0, error: 'HDFC header row not found' };

  const H = rows[hi].map(c => String(c).trim().toLowerCase());
  const di  = H.indexOf('date');
  const nai = H.findIndex(c => c.includes('narration'));
  const ri  = H.findIndex(c => c.includes('ref'));
  const wi  = H.findIndex(c => c.includes('withdrawal'));
  const dpi = H.findIndex(c => c.includes('deposit'));
  const bi  = H.findIndex(c => c.includes('balance'));

  const transactions = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const date = toISO(r[di]);
    if (!date) { skipped++; continue; }               // separator / summary / footer rows have no valid date
    const description = String(r[nai] ?? '').replace(/\s+/g, ' ').trim();
    const withdrawal = num(r[wi]);
    const deposit = num(r[dpi]);
    let amount = null;
    if (withdrawal) amount = -Math.abs(withdrawal);   // withdrawal → spend (negative)
    else if (deposit) amount = Math.abs(deposit);     // deposit → income (positive)
    if (amount === null || amount === 0) { skipped++; continue; }

    const refRaw = String(r[ri] ?? '').trim();
    const refNo = /^0*$/.test(refRaw) ? '' : refRaw;  // "000000000000000" is a placeholder, not a real ref
    const balance = String(r[bi] ?? '').trim();
    // stable dedup key: the bank ref when present, else date+running-balance+amount (unique per row)
    const ref = refNo || `${date}|${balance}|${amount}`;
    transactions.push({ date, description, amount, ref });
  }
  return { transactions, skipped };
}
