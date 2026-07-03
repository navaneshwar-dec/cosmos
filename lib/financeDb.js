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
  const insert = db.prepare('INSERT OR IGNORE INTO categories (user_id, name, parent_id) VALUES (?, ?, ?)');
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
  `);
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
