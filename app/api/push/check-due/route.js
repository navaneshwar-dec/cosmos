import { NextResponse } from 'next/server';
import webpush from 'web-push';
import sql, { initDb } from '../../../../lib/db';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.PUSH_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDb();

  const dueTasks = await sql`
    SELECT t.id, t.text, t.date, t.user_id
    FROM tasks t
    WHERE t.completed = false
      AND t.date IS NOT NULL
      AND t.push_notified_at IS NULL
      AND t.date <= NOW() + INTERVAL '15 minutes'
  `;

  let sent = 0, cleaned = 0;

  for (const task of dueTasks) {
    const subs = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${task.user_id}`;
    const overdue = new Date(task.date) < new Date();
    const payload = JSON.stringify({
      title: overdue ? '🔴 Overdue' : '⏰ Due soon',
      body: task.text,
      url: '/',
      tag: `task-${task.id}`,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
          cleaned++;
        }
      }
    }

    await sql`UPDATE tasks SET push_notified_at = NOW() WHERE id = ${task.id}`;
  }

  return NextResponse.json({ checked: dueTasks.length, sent, cleaned });
}
