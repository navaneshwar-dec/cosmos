const OLLAMA_BASE = 'http://localhost:11434';
const MODEL = 'llama3.1:8b';

export async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function buildPrompt(merchants, categoryPaths) {
  return `You are a personal finance transaction categorizer. Given a numbered list of merchant/transaction descriptions, assign each one to the SINGLE best-fitting category from this exact list (copy the category text exactly as shown character-for-character, never invent a new category):

${categoryPaths.map(c => `- ${c}`).join('\n')}

If nothing fits well, use null for that merchant instead of guessing.

Merchants to classify:
${merchants.map((m, i) => `${i}. "${m.description}"`).join('\n')}

Respond with ONLY a JSON object in this exact shape, no other text. "index" must be the number from the list above:
{"results": [{"index": 0, "category": "exact category text or null"}]}`;
}

async function callOllama(prompt) {
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
  });
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new Error('Ollama returned no content');
  return JSON.parse(content);
}

// Returns a Map of merchant_key -> exact categoryPath string, only for merchants
// the model matched to a category that actually exists in categoryPaths. Anything
// ambiguous, invented, or malformed is simply absent from the map (left for manual Review).
//
// Correlates responses back to input merchants by numeric index, not by asking the
// model to echo back the merchant_key string — small local models don't reliably
// preserve exact strings (whitespace/case/punctuation drift), which silently breaks
// any downstream lookup keyed on that echoed text. An integer index has no such risk.
export async function categorizeBatch(merchants, categoryPaths) {
  const prompt = buildPrompt(merchants, categoryPaths);
  const categorySet = new Map(categoryPaths.map(c => [c.toLowerCase(), c]));

  let parsed;
  try {
    parsed = await callOllama(prompt);
  } catch {
    parsed = await callOllama(prompt);
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const map = new Map();
  for (const r of results) {
    if (typeof r?.index !== 'number' || !r?.category) continue;
    const merchant = merchants[r.index];
    if (!merchant) continue;
    const matched = categorySet.get(String(r.category).trim().toLowerCase());
    if (matched) map.set(merchant.merchant_key, matched);
  }
  return map;
}
