import * as XLSX from 'xlsx';

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad = n => String(n).padStart(2, '0');

export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const nonEmpty = grid.filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map(h => String(h).trim());
  const rows = nonEmpty.slice(1);
  return { headers, rows };
}

export function parseStatementDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const s = String(value).trim();

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${year}-${pad(month)}-${pad(m[1])}`;
    }
  }

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }

  const parsed = Date.parse(s);
  return isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

export function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  let s = String(value).trim().replace(/,/g, '').replace(/^INR\s*/i, '').replace(/^Rs\.?\s*/i, '').replace(/[₹]/g, '');
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/^-/.test(s)) { sign = -1; s = s.slice(1); }
  if (/\s*(dr|debit)\s*$/i.test(s)) { sign = -1; s = s.replace(/\s*(dr|debit)\s*$/i, ''); }
  if (/\s*(cr|credit)\s*$/i.test(s)) { s = s.replace(/\s*(cr|credit)\s*$/i, ''); }

  const n = parseFloat(s.trim());
  return isNaN(n) ? null : n * sign;
}

export function guessColumnMapping(headers) {
  const find = regexes => headers.find(h => regexes.some(r => r.test(h)));

  const date        = find([/^date$/i, /transaction date/i, /txn date/i, /value date/i, /^date/i]);
  const description = find([/narration/i, /description/i, /particulars?/i, /remarks?/i, /details/i]);
  const debit       = find([/debit/i, /withdrawal/i, /\bdr\b/i]);
  const credit      = find([/credit/i, /deposit/i, /\bcr\b/i]);
  const amount      = find([/^amount$/i, /^amt$/i, /transaction amount/i]);

  if (debit && credit) return { date, description, amountMode: 'split', debit, credit, amount: null };
  return { date, description, amountMode: 'single', amount: amount ?? debit ?? credit ?? null, debit: null, credit: null };
}

export function mappingIsValid(mapping, headers) {
  if (!mapping?.date || !mapping?.description) return false;
  if (mapping.amountMode === 'split' && !(mapping.debit || mapping.credit)) return false;
  if (mapping.amountMode === 'single' && !mapping.amount) return false;
  const cols = [mapping.date, mapping.description, mapping.amount, mapping.debit, mapping.credit].filter(Boolean);
  return cols.every(c => headers.includes(c));
}

export function extractTransactions(headers, rows, mapping) {
  const idx = name => (name ? headers.indexOf(name) : -1);
  const dIdx = idx(mapping.date), descIdx = idx(mapping.description);
  const amtIdx = idx(mapping.amount), drIdx = idx(mapping.debit), crIdx = idx(mapping.credit);

  const transactions = [];
  let skipped = 0;

  for (const row of rows) {
    const date = parseStatementDate(row[dIdx]);
    const description = String(row[descIdx] ?? '').trim();
    let amount = null;

    if (mapping.amountMode === 'split') {
      const debit = drIdx >= 0 ? parseAmount(row[drIdx]) : null;
      const credit = crIdx >= 0 ? parseAmount(row[crIdx]) : null;
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    } else {
      amount = amtIdx >= 0 ? parseAmount(row[amtIdx]) : null;
    }

    if (!date || !description || amount === null || amount === 0) { skipped++; continue; }
    transactions.push({ date, description, amount });
  }

  return { transactions, skipped };
}
