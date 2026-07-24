import { tool } from 'ai';
import { z } from 'zod';
import path from 'path';
import Database from 'better-sqlite3';

// Text-to-SQL over the LOCAL finance DB. The question + schema go to a LOCAL model
// (Ollama) to produce SQL; the SQL runs on a read-only connection to finance.db; the
// rows are handed back to the (also local) chat model to phrase the answer. Nothing —
// not the schema, not the question, not the data — leaves the Mac.
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const SQL_MODEL = process.env.FINANCE_SQL_MODEL || 'qwen2.5:72b';
const ROW_CAP = 200;

function schemaDoc(userId) {
  return `Personal-finance SQLite database. Every row already belongs to this user — ALWAYS include "user_id = ${userId}" in the WHERE clause of every table you touch.

TABLES
transactions(id, user_id, account_id, date TEXT 'YYYY-MM-DD', description TEXT, merchant_key TEXT, amount REAL, category_id, notes)
  • amount < 0  = money spent (debit).  amount > 0 = money received (credit/income).
  • For "how much did I spend" use SUM(-amount) over amount < 0. For income use SUM(amount) over amount > 0.
accounts(id, user_id, name, type 'credit_card'|'bank_account', issuer, last4)
categories(id, user_id, name, parent_id)
  • parent_id IS NULL → top-level category; otherwise it is a subcategory of parent_id.
  • Join transactions.category_id → categories.id. For the human category name, use the PARENT's name when parent_id is set (subcategory rolls up to its parent), e.g.
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    ... COALESCE(p.name, c.name) AS category
tx_labels(id, user_id, transaction_id, label)  • freeform user labels on a transaction

CONVENTIONS
• Dates are ISO text. Filter a month with substr(date,1,7) = 'YYYY-MM'; a range with date BETWEEN '...' AND '...'.
• category_id IS NULL means the transaction is uncategorized.
• Amounts are in INR.`;
}

async function generateSql(question, userId, today) {
  const prompt = `${schemaDoc(userId)}

Today is ${today} (IST). Interpret "this month", "last month", "this year" relative to that.

Write exactly ONE read-only SQLite query that answers the user's question.
Question: "${question}"

Requirements:
- A single SELECT (a leading WITH ... SELECT is fine). No INSERT/UPDATE/DELETE/DDL/PRAGMA, no semicolons beyond one optional trailing one.
- Every table reference must be filtered by user_id = ${userId}.
- If it returns individual rows (not an aggregate), add LIMIT ${ROW_CAP}.
- Output ONLY the SQL. No explanation, no markdown code fences.`;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SQL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      // keep the model resident (avoid a 47GB reload between questions) and cap output —
      // SQL is short, so don't let it ramble.
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m',
      options: { temperature: 0, num_predict: 512 },
    }),
    signal: AbortSignal.timeout(Number(process.env.FINANCE_SQL_TIMEOUT_MS || 180000)),
  });
  if (!res.ok) throw new Error(`local SQL model failed (${res.status})`);
  const data = await res.json();
  let sql = (data?.message?.content || '').trim();
  // strip ```sql ... ``` fences if the model added them
  sql = sql.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  return sql;
}

// Defence in depth: reject anything that isn't a single read-only SELECT.
function assertReadOnly(raw) {
  const sql = raw.replace(/;\s*$/, '').trim();
  if (!sql) throw new Error('empty query');
  if (sql.includes(';')) throw new Error('only a single statement is allowed');
  if (!/^(select|with)\b/i.test(sql)) throw new Error('only SELECT queries are allowed');
  if (/\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex)\b/i.test(sql)) {
    throw new Error('write/DDL statements are not allowed');
  }
  return sql;
}

function runReadOnly(sql) {
  // separate read-only connection — the query physically cannot write, even if
  // validation somehow missed something.
  const db = new Database(path.join(process.cwd(), 'data', 'finance.db'), { readonly: true });
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

export function financeTools(userId, today) {
  return {
    query_finance: tool({
      description: "Answer any question about the user's personal finances — spending, income, transactions, merchants, categories, accounts, balances, trends, totals. It writes a SQL query for the question and runs it on the LOCAL finance database (nothing leaves the device). Restate the user's question clearly and self-contained. After it returns rows, summarize the answer in plain language with concrete ₹ amounts.",
      inputSchema: z.object({
        question: z.string().describe("The user's finance question, restated clearly and self-contained (include any time range they meant)."),
      }),
      execute: async ({ question }) => {
        try {
          const sql = assertReadOnly(await generateSql(question, userId, today));
          const all = runReadOnly(sql);
          const rows = all.slice(0, ROW_CAP);
          return { sql, rowCount: all.length, truncated: all.length > rows.length, rows };
        } catch (e) {
          return { error: e.message || String(e), hint: 'Try rephrasing the question, or ask for a narrower time range.' };
        }
      },
    }),
  };
}
