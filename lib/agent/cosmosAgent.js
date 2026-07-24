import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { istDateKey } from '../dates';
import { cosmosTools } from './tools';
import { financeTools } from './financeTools';

// ── System prompt (the agent's persona + rules; edit here) ────────────────────
export function systemPrompt(name, financeEnabled) {
  return [
    `You are the built-in assistant inside "cosmos", ${name || 'the user'}'s personal life dashboard.`,
    `Today is ${istDateKey()} (timezone: Asia/Kolkata / IST). Treat all dates and times as IST.`,
    `You can call tools to read the user's live data: today's agenda, to-do tasks, work/priority items, gym logs, and daily routine.`,
    `Call a tool whenever the question depends on their actual data; otherwise just answer. Prefer get_today for "what's on / what's due / what should I do".`,
    financeEnabled
      ? `For ANY question about money — spending, income, transactions, merchants, categories, accounts, balances, trends, totals — call query_finance with a clear self-contained restatement of the question, then answer from the rows it returns. It runs entirely on this device. Format money as ₹ in Indian style (e.g. ₹9,32,478 or ₹9.3L). If it returns an error, tell the user briefly and suggest rephrasing.`
      : `You do NOT have access to financial data and must never ask for or infer it.`,
    `Be concise and direct. Use the user's own labels and names. When you list items, keep it scannable.`,
  ].join(' ');
}

// ── Model selection: one agent, either backend ────────────────────────────────
function pickModel(id) {
  if (!id || id === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    return google(process.env.GEMINI_MODEL || 'gemini-flash-latest');
  }
  // local Ollama via its OpenAI-compatible endpoint (nothing leaves the Mac)
  const ollama = createOpenAICompatible({
    name: 'ollama',
    baseURL: (process.env.OLLAMA_URL || 'http://localhost:11434') + '/v1',
  });
  return ollama(id); // e.g. 'llama3.1:8b'
}

// ── The agent: streams a response, running the tool loop as needed ────────────
export async function streamCosmosAgent({ model, messages, userId, name, finance }) {
  const modelMessages = await convertToModelMessages(messages); // async in AI SDK v7
  // Finance querying is offered ONLY to the finance assistant (finance:true) AND only on a
  // local model — so finance data (schema, query, rows) can never reach a cloud model, and
  // the general assistant has no finance access at all.
  const isLocal = !!model && model !== 'gemini';
  const financeEnabled = !!finance && isLocal;
  const tools = financeEnabled
    ? { ...cosmosTools(userId), ...financeTools(userId, istDateKey()) }
    : cosmosTools(userId);
  return streamText({
    model: pickModel(model),
    system: systemPrompt(name, financeEnabled),
    tools,
    stopWhen: stepCountIs(6),        // cap the agentic tool loop
    messages: modelMessages,
  });
}
