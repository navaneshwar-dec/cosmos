import sql, { initDb } from './db';

// These routes are called by Open WebUI's Python backend, which has no browser
// session cookie to send — so they check a static shared secret instead of auth().
// Safe because this app is single-user and everything stays on localhost.
export async function requireAssistantKey(req) {
  const key = req.headers.get('x-assistant-key');
  if (!key || key !== process.env.ASSISTANT_API_KEY) return null;

  await initDb();
  const rows = await sql`SELECT id FROM users WHERE email = ${process.env.ADMIN_EMAIL}`;
  return rows[0]?.id ?? null;
}
