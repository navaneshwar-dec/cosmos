import * as XLSX from 'xlsx';
import { decryptOffice } from '../decrypt';

// Processor for Axis ACE credit-card statements (.xlsx, may or may not be password-protected).
// Layout: summary rows, then a header "Date | Transaction Details | Amount (INR) | Debit/Credit",
// dates "DD Mon 'YY", amounts "₹ 1,234.56", and an explicit Debit/Credit indicator column.
export const meta = { id: 'axis_ace', label: 'Axis ACE — Credit Card', accountType: 'credit_card', encrypted: false };

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function toISO(s) {
  const m = String(s).trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+'?(\d{2,4})/); // "15 Feb '25"
  if (!m) return null;
  const mm = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  const yy = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${yy}-${mm}-${String(m[1]).padStart(2, '0')}`;
}
function num(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

export async function parse(buffer, { password } = {}) {
  const decrypted = await decryptOffice(buffer, password);
  const wb = XLSX.read(decrypted, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });

  let hi = -1;
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].map(c => String(c).toLowerCase()).join('|');
    if (/date/.test(j) && /amount/.test(j) && j.includes('debit') && j.includes('credit')) { hi = i; break; }
  }
  if (hi < 0) return { transactions: [], skipped: 0, error: 'Axis ACE header row not found' };

  const H = rows[hi].map(c => String(c).trim().toLowerCase());
  const di = H.indexOf('date');
  const dei = H.findIndex(c => c.includes('detail'));
  const ai = H.findIndex(c => c.includes('amount'));
  const ii = H.findIndex(c => c.includes('debit') && c.includes('credit')); // "Debit/Credit" indicator

  const transactions = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const date = toISO(r[di]);
    if (!date) { skipped++; continue; }                 // summary/footer rows have no valid date
    const description = String(r[dei] ?? '').replace(/\s+/g, ' ').trim();
    const mag = num(r[ai]);
    if (mag == null || mag === 0) { skipped++; continue; }
    const indicator = String(r[ii] ?? '').trim().toLowerCase();
    // credit card: Debit = charge = spend (negative); Credit = payment / cashback = money in (positive)
    const amount = indicator.includes('credit') ? Math.abs(mag) : -Math.abs(mag);
    // no ref/balance column on Axis ACE → commit falls back to a content hash for dedup
    transactions.push({ date, description, amount });
  }
  return { transactions, skipped };
}
