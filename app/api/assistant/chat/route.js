import { auth } from '../../../../auth';
import { initDb } from '../../../../lib/db';
import { streamCosmosAgent } from '../../../../lib/agent/cosmosAgent';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  await initDb();

  const { messages = [], model = 'gemini' } = await req.json();
  const name = session.user.name?.split(' ')[0];

  const result = await streamCosmosAgent({ model, messages, userId: session.user.id, name });

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[assistant/chat]', msg);
      if (!process.env.GEMINI_API_KEY && model === 'gemini') {
        return 'Gemini key not set — add GEMINI_API_KEY to .env.local, or switch to a local model.';
      }
      return msg;
    },
  });
}
