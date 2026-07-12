import * as XLSX from 'xlsx';

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad = n => String(n).padStart(2, '0');

// Shared between header-row detection and column-mapping guesses so both
// reason about "what a header cell looks like" the same way, for any issuer's layout.
const HEADER_PATTERNS = {
  date:        [/^date$/i, /transaction date/i, /txn date/i, /value date/i, /^date/i],
  description: [/narration/i, /description/i, /particulars?/i, /remarks?/i, /transaction details/i, /details/i],
  debit:       [/debit/i, /withdrawal/i, /\bdr\b/i],
  credit:      [/credit/i, /deposit/i, /\bcr\b/i],
  amount:      [/^amount$/i, /^amt$/i, /transaction amount/i, /amount/i],
};

// Statement exports often have a letterhead/account-summary block above the real
// transaction table (see Axis Bank export: bank logo, address, payment summary,
// THEN "Date | Transaction Details | Amount (INR) | Debit/Credit"). Scan every row
// for the one that looks like a header row instead of assuming row 0 is it.
function findHeaderRowIndex(grid) {
  let bestIdx = -1, bestScore = 0;
  for (let i = 0; i < grid.length; i++) {
    const cells = grid[i].map(c => String(c ?? '').trim()).filter(Boolean);
    if (cells.length < 2) continue;

    let score = 0, hasDate = false, hasDescOrAmount = false;
    for (const cell of cells) {
      if (HEADER_PATTERNS.date.some(r => r.test(cell))) { score++; hasDate = true; }
      else if (
        HEADER_PATTERNS.description.some(r => r.test(cell)) ||
        HEADER_PATTERNS.debit.some(r => r.test(cell)) ||
        HEADER_PATTERNS.credit.some(r => r.test(cell)) ||
        HEADER_PATTERNS.amount.some(r => r.test(cell))
      ) { score++; hasDescOrAmount = true; }
    }
    if (hasDate && hasDescOrAmount && score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

// Real .xlsx (zip, signature "PK..") and legacy .xls (OLE2, signature "\xD0\xCF\x11\xE0")
// carry their own internal encoding info that SheetJS reads correctly. Plain CSV text has
// none — SheetJS's buffer-mode codepage sniffing can misread UTF-8 (₹ etc.) as Latin-1,
// silently corrupting every amount cell. Decoding CSV as a UTF-8 string ourselves first
// sidesteps that guesswork entirely.
function isBinaryWorkbook(buffer) {
  if (buffer.length < 4) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  return isZip || isOle;
}

export function parseWorkbook(buffer) {
  const wb = isBinaryWorkbook(buffer)
    ? XLSX.read(buffer, { type: 'buffer', raw: true })
    : XLSX.read(buffer.toString('utf8'), { type: 'string', raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const nonEmpty = grid.filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
  if (nonEmpty.length === 0) return { headers: [], rows: [], headerRowConfident: false };

  const headerIdx = findHeaderRowIndex(nonEmpty);
  const confident = headerIdx >= 0;
  const startIdx = confident ? headerIdx : 0;

  const headers = nonEmpty[startIdx].map(h => String(h).trim());
  const rows = nonEmpty.slice(startIdx + 1);
  return { headers, rows, headerRowConfident: confident };
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

  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s]'?(\d{2,4})/);
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

  // Date.parse on a date-only, non-ISO string resolves to local midnight in this
  // engine, but toISOString() renders in UTC — for any timezone ahead of UTC that
  // silently rolls the date back one day. Format from local getters instead so the
  // calendar date the parser resolved to is exactly the date we store.
  const parsed = Date.parse(s);
  if (isNaN(parsed)) return null;
  const d = new Date(parsed);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  const date        = find(HEADER_PATTERNS.date);
  const description = find(HEADER_PATTERNS.description);
  const debit       = find(HEADER_PATTERNS.debit);
  const credit      = find(HEADER_PATTERNS.credit);
  const amount      = find(HEADER_PATTERNS.amount);

  const base = { date, description, amount: null, debit: null, credit: null, indicator: null };

  // A single column can hold a text label ("Debit"/"Credit") rather than a value —
  // e.g. Axis Bank's export has "Amount (INR)" (always positive) plus a separate
  // "Debit/Credit" label column. debit/credit patterns both matching the *same*
  // header means it's a label column, not two value columns — pair it with the
  // amount column as the sign indicator instead of treating it as a split amount.
  if (debit && credit && debit === credit && amount && amount !== debit) {
    return { ...base, amountMode: 'indicator', amount, indicator: debit };
  }
  if (debit && credit && debit !== credit) {
    return { ...base, amountMode: 'split', debit, credit };
  }
  return { ...base, amountMode: 'single', amount: amount ?? debit ?? credit ?? null };
}

export function mappingIsValid(mapping, headers) {
  if (!mapping?.date || !mapping?.description) return false;
  if (mapping.amountMode === 'split' && !(mapping.debit || mapping.credit)) return false;
  if (mapping.amountMode === 'single' && !mapping.amount) return false;
  if (mapping.amountMode === 'indicator' && !(mapping.amount && mapping.indicator)) return false;
  const cols = [mapping.date, mapping.description, mapping.amount, mapping.debit, mapping.credit, mapping.indicator].filter(Boolean);
  return cols.every(c => headers.includes(c));
}

export function extractTransactions(headers, rows, mapping) {
  const idx = name => (name ? headers.indexOf(name) : -1);
  const dIdx = idx(mapping.date), descIdx = idx(mapping.description);
  const amtIdx = idx(mapping.amount), drIdx = idx(mapping.debit), crIdx = idx(mapping.credit);
  const indIdx = idx(mapping.indicator);

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
    } else if (mapping.amountMode === 'indicator') {
      const magnitude = amtIdx >= 0 ? parseAmount(row[amtIdx]) : null;
      const label = indIdx >= 0 ? String(row[indIdx] ?? '').trim().toLowerCase() : '';
      if (magnitude !== null) {
        if (/debit|dr/.test(label)) amount = -Math.abs(magnitude);
        else if (/credit|cr/.test(label)) amount = Math.abs(magnitude);
      }
    } else {
      amount = amtIdx >= 0 ? parseAmount(row[amtIdx]) : null;
    }

    if (!date || !description || amount === null || amount === 0) { skipped++; continue; }
    transactions.push({ date, description, amount });
  }

  return { transactions, skipped };
}
