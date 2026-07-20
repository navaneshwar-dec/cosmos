import { tool } from 'ai';
import { z } from 'zod';
import { TOOL_DEFS, executeTool } from '../assistantTools';

// The cosmos agent's predefined tools, bound to a user. Finance is deliberately
// NOT registered here — no finance data can ever reach a model.
const desc = name => TOOL_DEFS.find(t => t.name === name)?.description || name;

// Postgres returns date/timestamptz columns as JS Date objects, which are NOT valid
// JSON values — the AI SDK rejects them in tool output. Convert Dates to IST strings
// and guarantee a plain JSON-serializable result.
function istSafe(v) {
  if (v instanceof Date) return v.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (Array.isArray(v)) return v.map(istSafe);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = istSafe(v[k]); return o; }
  return v;
}

export function cosmosTools(userId) {
  const run = name => async (args) => istSafe(await executeTool(userId, name, args || {}));
  return {
    get_today: tool({
      description: desc('get_today'),
      inputSchema: z.object({}),
      execute: run('get_today'),
    }),
    get_tasks: tool({
      description: desc('get_tasks'),
      inputSchema: z.object({
        status: z.enum(['pending', 'overdue', 'today', 'completed', 'all']).optional(),
        label: z.string().optional(),
      }),
      execute: run('get_tasks'),
    }),
    get_work: tool({
      description: desc('get_work'),
      inputSchema: z.object({
        status: z.enum(['open', 'completed', 'all']).optional(),
        priority: z.number().int().min(1).max(4).optional(),
      }),
      execute: run('get_work'),
    }),
    get_gym: tool({
      description: desc('get_gym'),
      inputSchema: z.object({ days: z.number().int().optional() }),
      execute: run('get_gym'),
    }),
    get_routine: tool({
      description: desc('get_routine'),
      inputSchema: z.object({}),
      execute: run('get_routine'),
    }),
  };
}
