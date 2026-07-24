const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.FINANCE_LLM_MODEL || 'llama3.1:8b';

export async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const dir = m => (m.is_credit ? '[money IN] ' : '[money OUT] ');

function buildPrompt(merchants, categoryPaths, examples = []) {
  const examplesBlock = examples.length
    ? `\nThis user has previously categorized these — follow the same preferences for similar ones:\n${examples.map(e => `- ${dir(e)}"${e.text}" → ${e.category}`).join('\n')}\n`
    : '';
  return `You are a personal finance transaction categorizer. Assign each numbered merchant/transaction description to the SINGLE best-fitting category from this exact list (copy the category text exactly, character-for-character; never invent a category):

${categoryPaths.map(c => `- ${c}`).join('\n')}
${examplesBlock}
Rules:
- Classify by what the merchant actually sells or does — the intent — not by the wording.
- Ignore legal suffixes (LTD, LIMITED, PVT, TECHNOLOGIES), city/state codes, and payment-gateway prefixes (RAZ*, ING*, CAS*, BBPS, MB/IB).
- Intent over wording, e.g.: "SWIGGY LIMITED" / "BUNDL TECHNOLOGIES" = Swiggy, a food-delivery app. "REDBUS" = bus ticket booking (public transport). "NETFLIX" = streaming subscription.
- DIRECTION MATTERS. [money OUT] is a payment you MADE; [money IN] is a credit/deposit/refund/interest/cashback you RECEIVED. Bank codes like DEP, ACHCr/NACH-Cr, CR, IMPS-CR, REV = money in.
- A [money IN] item can ONLY be an income-side category: Income (or Income > Salary / Refunds / Interest), Cashback, or Transfers. NEVER assign money-in to a spending category (Bills & Utilities, Food & Dining, Shopping, Transport, Entertainment, etc.). If a money-in item doesn't clearly fit an income-side category, use null.
- Payment RAILS are just HOW money moved, not what it was for. SBI writes EVERY outgoing UPI as "WDL TFR UPI/DR/<ref>/<payee>/<bank>/..." — the payee after the ref is what matters. IMPS/NEFT/RTGS are also just rails. Judge by the PAYEE:
   • Sent to a PERSON'S NAME, to your OWN or another bank ACCOUNT (payee like "Bank Acc" or an account number), or a credit-card bill payment (CRED, paying off a card) → "Transfers" (money moved, not spent).
   • Paid to a BUSINESS / shop / app (Swiggy, Amazon, a store, a service, a biller) → classify by what that business sells (Food & Dining, Shopping, Transport, Bills & Utilities, etc.).
- ATM cash withdrawals ("ATM WDL", "ATM CASH", "NWD") → "Transfers" (cash taken out, not a purchase).
- "Fees & Charges" is ONLY for actual bank/card fees, interest charged, penalties, and GST/service charges — NEVER for UPI payments, transfers, ATM withdrawals, or bill payments.
- If nothing fits well, use null instead of guessing.

Transactions to classify (each tagged with money direction):
${merchants.map((m, i) => `${i}. ${dir(m)}"${m.description}"`).join('\n')}

Respond with ONLY a JSON object in this exact shape, no other text. "index" is the number from the list above:
{"results": [{"index": 0, "category": "exact category text or null"}]}`;
}

const BATCH_TIMEOUT_MS = Number(process.env.FINANCE_LLM_TIMEOUT_MS || 300000); // 5 min/batch cap

async function callOllama(prompt, signal) {
  // batch timeout, plus an optional external cancel signal (Stop button)
  const timeout = AbortSignal.timeout(BATCH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      format: 'json',
      stream: false,
      options: { temperature: 0 },
    }),
    signal: combined,
  });
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new Error('Ollama returned no content');
  return JSON.parse(content);
}

// Returns an array of { merchant, category } for merchants the model matched to a
// category that actually exists in categoryPaths. Anything ambiguous, invented, or
// malformed is simply absent (left for manual Review). The full merchant object is
// returned (not just its key) so the caller can apply per (merchant_key, direction) —
// the same merchant can legitimately map to different categories for credit vs debit.
//
// Correlates responses back to input merchants by numeric index, not by asking the
// model to echo back the merchant_key string — small local models don't reliably
// preserve exact strings (whitespace/case/punctuation drift), which silently breaks
// any downstream lookup keyed on that echoed text. An integer index has no such risk.
export async function categorizeBatch(merchants, categoryPaths, examples = [], signal) {
  const prompt = buildPrompt(merchants, categoryPaths, examples);
  const categorySet = new Map(categoryPaths.map(c => [c.toLowerCase(), c]));

  let parsed;
  try {
    parsed = await callOllama(prompt, signal);
  } catch (err) {
    if (signal?.aborted) throw err;   // cancelled — don't retry
    parsed = await callOllama(prompt, signal);
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const out = [];
  for (const r of results) {
    if (typeof r?.index !== 'number' || !r?.category) continue;
    const merchant = merchants[r.index];
    if (!merchant) continue;
    const matched = categorySet.get(String(r.category).trim().toLowerCase());
    if (matched) out.push({ merchant, category: matched });
  }
  return out;
}
