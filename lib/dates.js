// The user always works in IST (Asia/Kolkata, UTC+5:30). These helpers pin IST
// explicitly so they're correct on BOTH the client (IST device) and the server
// (Vercel/Node runs in UTC). Never derive a calendar date via toISOString() — that
// is UTC and rolls back a day between 00:00–05:29 IST.
export const IST_TZ = 'Asia/Kolkata';

// 'YYYY-MM-DD' calendar date in IST (en-CA locale renders ISO order)
export function istDateKey(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

// 'YYYY-MM' month key in IST
export function istMonthKey(d = new Date()) {
  return istDateKey(d).slice(0, 7);
}

// weekday (0=Sun … 6=Sat) of an instant, evaluated in IST
export function istWeekday(d = new Date()) {
  return new Date(istDateKey(d) + 'T12:00:00Z').getUTCDay();
}
