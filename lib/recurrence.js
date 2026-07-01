const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export function parseRecurrence(text) {
  const t = text.toLowerCase();

  if (/every\s+day|daily|each\s+day|every\s+morning|every\s+night|every\s+evening/.test(t)) return 'daily';
  if (/every\s+weekday|weekdays|mon(day)?\s+(to|-)\s+fri(day)?/.test(t)) return 'weekdays';
  if (/every\s+week(?!day)|weekly/.test(t)) return 'weekly';
  if (/every\s+month|monthly/.test(t)) return 'monthly';

  if (/every|each/.test(t)) {
    const days = [];
    if (/\bmon(day)?\b/.test(t)) days.push('mon');
    if (/\btue(s(day)?)?\b/.test(t)) days.push('tue');
    if (/\bwed(nesday)?\b/.test(t)) days.push('wed');
    if (/\bthu(r(sday)?)?\b/.test(t)) days.push('thu');
    if (/\bfri(day)?\b/.test(t)) days.push('fri');
    if (/\bsat(urday)?\b/.test(t)) days.push('sat');
    if (/\bsun(day)?\b/.test(t)) days.push('sun');
    if (days.length > 0) return days.join(',');
  }

  return null;
}

export function formatRecurrence(recurrence) {
  if (!recurrence) return null;
  const fixed = { daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays', monthly: 'Monthly' };
  if (fixed[recurrence]) return fixed[recurrence];
  return recurrence.split(',').map(d => DAY_LABELS[d] || d).join(', ');
}

export function getNextOccurrence(recurrence, fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();
  const next = new Date(base);

  if (recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (recurrence === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next.toISOString();
  }

  if (recurrence === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }

  if (recurrence === 'weekdays') {
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  const days = recurrence.split(',').map(d => DAY_MAP[d]).filter(n => n !== undefined);
  if (days.length > 0) {
    next.setDate(next.getDate() + 1);
    for (let i = 0; i < 8; i++) {
      if (days.includes(next.getDay())) return next.toISOString();
      next.setDate(next.getDate() + 1);
    }
  }

  return null;
}
