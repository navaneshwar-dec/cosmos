import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const g = globalThis;

if (!g.__financeDb) {
  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  g.__financeDb = new Database(path.join(dataDir, 'finance.db'));
  g.__financeDb.pragma('journal_mode = WAL');
}
const db = g.__financeDb;

const STARTER_CATEGORIES = {
  'Food & Dining':       ['Groceries', 'Dining Out', 'Food Delivery'],
  'Transport':           ['Fuel', 'Cabs/Auto', 'Public Transport', 'Parking'],
  'Bills & Utilities':   ['Electricity', 'Water', 'Internet/Phone', 'Rent'],
  'Shopping':            ['Clothing', 'Electronics', 'Home', 'General'],
  'Entertainment':       ['Movies/OTT', 'Subscriptions', 'Hobbies'],
  'Health & Fitness':    ['Medical', 'Pharmacy', 'Gym'],
  'Travel':              ['Flights', 'Hotels', 'Trip Expenses'],
  'Investments & Savings': ['SIP/Mutual Funds', 'Stocks', 'Fixed Deposit'],
  'Income':              ['Salary', 'Refunds', 'Interest'],
  'Fees & Charges':      ['Bank Fees', 'Card Fees', 'Interest Charged'],
  'Transfers':           ['To/From Own Accounts'],
  'Other':               [],
};

function seedCategories(userId) {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (user_id, name, parent_id, is_default) VALUES (?, ?, ?, 1)');
  const tx = db.transaction(() => {
    for (const [top, subs] of Object.entries(STARTER_CATEGORIES)) {
      insert.run(userId, top, null);
      const parentId = db.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ? AND parent_id IS NULL').get(userId, top).id;
      for (const sub of subs) insert.run(userId, sub, parentId);
    }
  });
  tx();
}

if (!g.__financeMigrated) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit_card','bank_account')),
      issuer TEXT,
      last4 TEXT,
      color TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id),
      UNIQUE(user_id, name, parent_id)
    );

    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      filename TEXT,
      imported_at TEXT DEFAULT (datetime('now')),
      row_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      statement_id INTEGER REFERENCES statements(id),
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      merchant_key TEXT,
      amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tx_user     ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_account  ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions(date);

    CREATE TABLE IF NOT EXISTS merchant_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      merchant_key TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      UNIQUE(user_id, merchant_key)
    );

    CREATE TABLE IF NOT EXISTS import_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      issuer TEXT NOT NULL,
      column_map TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, issuer)
    );

    CREATE TABLE IF NOT EXISTS tx_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      label TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(transaction_id, label)
    );
    CREATE INDEX IF NOT EXISTS idx_txlabels_txn   ON tx_labels(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_txlabels_label ON tx_labels(user_id, label);

    CREATE TABLE IF NOT EXISTS categorize_jobs (
      user_id    INTEGER PRIMARY KEY,
      status     TEXT NOT NULL,               -- 'running' | 'done' | 'error'
      total      INTEGER DEFAULT 0,
      done       INTEGER DEFAULT 0,
      tagged     INTEGER DEFAULT 0,
      recent     TEXT DEFAULT '[]',           -- JSON: last few {merchant, category}
      error      TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── source framework: per-source password + sample + processor, and dedup key ──
  const addColumn = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  addColumn('accounts', 'password_enc',    'TEXT');   // encrypted statement-file password
  addColumn('accounts', 'sample_filename', 'TEXT');   // uploaded sample template (in data/samples/)
  addColumn('accounts', 'processor',       'TEXT');   // JSON format profile derived from the sample
  addColumn('transactions', 'txn_uid',     'TEXT');   // stable per-transaction id for dedup
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_uid ON transactions(user_id, txn_uid) WHERE txn_uid IS NOT NULL;`);

  // ── direction-aware merchant rules: a merchant can map to a different category for
  //    money-in (credit) vs money-out (debit), so a refund never inherits a spend category ──
  const mrCols = db.prepare('PRAGMA table_info(merchant_rules)').all().map(c => c.name);
  if (!mrCols.includes('is_credit')) {
    db.exec(`
      CREATE TABLE merchant_rules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        merchant_key TEXT NOT NULL,
        is_credit INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        UNIQUE(user_id, merchant_key, is_credit)
      );
      INSERT INTO merchant_rules_new (id, user_id, merchant_key, is_credit, category_id)
        SELECT id, user_id, merchant_key, 0, category_id FROM merchant_rules;
      DROP TABLE merchant_rules;
      ALTER TABLE merchant_rules_new RENAME TO merchant_rules;
    `);
  }

  // ── seeded taxonomy is locked (can't rename/delete); only user-added ones are editable ──
  addColumn('categories', 'is_default', 'INTEGER DEFAULT 0');
  // Backfill: flag the known starter taxonomy for existing users. Rows the user added
  // themselves won't match the starter names and stay is_default = 0 (editable).
  const flagTop = db.prepare('UPDATE categories SET is_default = 1 WHERE user_id = ? AND parent_id IS NULL AND name = ?');
  const getTop  = db.prepare('SELECT id FROM categories WHERE user_id = ? AND parent_id IS NULL AND name = ?');
  const flagSub = db.prepare('UPDATE categories SET is_default = 1 WHERE user_id = ? AND parent_id = ? AND name = ?');
  for (const { user_id } of db.prepare('SELECT DISTINCT user_id FROM categories').all()) {
    for (const [top, subs] of Object.entries(STARTER_CATEGORIES)) {
      flagTop.run(user_id, top);
      const row = getTop.get(user_id, top);
      if (row) for (const sub of subs) flagSub.run(user_id, row.id, sub);
    }
  }

  g.__financeMigrated = true;
}

export function ensureUserSeeded(userId) {
  const row = db.prepare('SELECT 1 FROM categories WHERE user_id = ? LIMIT 1').get(userId);
  if (!row) seedCategories(userId);
}

export function normalizeMerchantKey(description) {
  return description
    .toUpperCase()
    .replace(/\d{4,}/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export default db;
