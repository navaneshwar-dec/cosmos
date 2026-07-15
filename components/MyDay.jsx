'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import RoutineManager from './RoutineManager';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const TYPE = {
  routine: { color: '#14b8a6' },
  todo:    { color: '#0ea5e9' },
  work:    { color: '#f59e0b' },
};

function isToday(d) { return d ? new Date(d).toDateString() === new Date().toDateString() : false; }
function isOverdue(d) { if (!d) return false; const x = new Date(d); return x < new Date() && !isToday(d); }
function timeMinutesOf(d) { const x = new Date(d); const m = x.getHours() * 60 + x.getMinutes(); return m === 0 ? null : m; }
function fmtMin(min) { if (min == null) return null; const h = Math.floor(min / 60), m = min % 60; const ap = h < 12 ? 'AM' : 'PM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`; }

// normalize a raw myday item → display shape, or null to drop it
function normalize(it, nowMin) {
  if (it.type === 'routine') {
    const min = it.time ? (() => { const [h, m] = it.time.split(':').map(Number); return h * 60 + m; })() : null;
    if (!it.done && min != null && min < nowMin) return null;   // missed & undone → hide (reconcile on Routine page)
    return { key: `routine-${it.id}`, type: 'routine', id: it.id, title: it.title, min, done: it.done };
  }
  if (it.type === 'todo') {
    if (!(isToday(it.date) || isOverdue(it.date))) return null;
    return { key: `todo-${it.id}`, type: 'todo', id: it.id, title: it.title, min: timeMinutesOf(it.date), done: false, overdue: isOverdue(it.date) };
  }
  // work
  const p1 = it.priority === 1;
  if (!(p1 || isToday(it.deadline) || isOverdue(it.deadline))) return null;
  return { key: `work-${it.id}`, type: 'work', id: it.id, title: it.title, min: timeMinutesOf(it.deadline), done: false, p1, overdue: isOverdue(it.deadline) };
}

const SECTIONS = [
  { key: 'morning',   label: 'Morning',   test: m => m != null && m < 720 },
  { key: 'afternoon', label: 'Afternoon', test: m => m != null && m >= 720 && m < 1020 },
  { key: 'evening',   label: 'Evening',   test: m => m != null && m >= 1020 },
  { key: 'anytime',   label: 'Anytime',   test: m => m == null },
];

export default function MyDay() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, mutate } = useSWR(`/api/myday?date=${today}`, fetcher, { revalidateOnFocus: true });
  const { data: session } = useSession();
  const [items, setItems] = useState([]);
  const [routineOpen, setRoutineOpen] = useState(false);

  useEffect(() => {
    if (!data?.items) return;
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
    setItems(data.items.map(it => normalize(it, nowMin)).filter(Boolean));
  }, [data]);

  function toggle(item) {
    const done = !item.done;
    setItems(prev => prev.map(i => i.key === item.key ? { ...i, done } : i));
    if (item.type === 'routine') {
      fetch('/api/routines/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routineId: item.id, date: today, done }) });
    } else if (item.type === 'todo') {
      fetch(`/api/tasks/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: done }) });
    } else {
      fetch(`/api/work/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: done }) });
    }
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = session?.user?.name?.split(' ')[0] ?? '';
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>{greeting}{name ? `, ${name}` : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{dateStr}</div>
          </div>
          <button onClick={() => setRoutineOpen(true)} aria-label="Manage daily routine" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#14b8a618', border: '1px solid #14b8a644', borderRadius: 20, padding: '7px 13px', color: '#2dd4bf', fontSize: 12, fontWeight: 700 }}>⚙ Routine</button>
        </div>
        {total > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 7, background: 'var(--glass-2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: 'linear-gradient(90deg,#5eead4,#a78bfa)', boxShadow: '0 0 12px var(--accent-glow)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>{doneCount} of {total} done</div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="todo-scroll-pad" style={{ padding: '0 14px 24px' }}>
        {!data && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>{[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 50, background: 'var(--glass-1)', borderRadius: 14, opacity: o }} />)}</div>}

        {data && total === 0 && (
          <div style={{ textAlign: 'center', padding: '54px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌤️</div>
            <div style={{ fontSize: 16, color: '#444', fontWeight: 600 }}>Nothing scheduled</div>
            <div style={{ fontSize: 13, color: '#2e2e2e', marginTop: 6 }}>Add a routine, or a to-do / work item with today's date</div>
          </div>
        )}

        {SECTIONS.map(sec => {
          const secItems = items.filter(i => sec.test(i.min)).sort((a, b) => (a.min ?? 1e9) - (b.min ?? 1e9));
          if (secItems.length === 0) return null;
          return (
            <div key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 2px 8px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)' }}>{sec.label}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {secItems.map(item => {
                const color = item.p1 ? '#f87171' : TYPE[item.type].color;
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px', marginBottom: 7, background: item.p1 ? 'rgba(239,68,68,0.10)' : 'var(--glass-1)', border: `1px solid ${item.p1 ? 'rgba(239,68,68,0.26)' : 'var(--border)'}`, borderRadius: 14, opacity: item.done ? 0.5 : 1 }}>
                    <button onClick={() => toggle(item)} aria-label={`${item.done ? 'Mark not done' : 'Mark done'}: ${item.title}`} style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: `2px solid ${item.done ? color : 'rgba(255,255,255,0.22)'}`, background: item.done ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a10', fontSize: 12, fontWeight: 800, boxShadow: item.done ? `0 0 10px ${color}55` : 'none' }}>{item.done && '✓'}</button>
                    <span style={{ fontSize: 11, color: item.overdue ? '#f87171' : 'var(--text-faint)', width: 60, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{item.overdue ? '⚠ over' : fmtMin(item.min) ?? ''}</span>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}88` }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: item.done ? 'var(--text-faint)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    {item.p1 && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'rgba(239,68,68,.22)', color: '#f87171', flexShrink: 0 }}>P1</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <RoutineManager open={routineOpen} onClose={() => { setRoutineOpen(false); mutate(); }} />
    </div>
  );
}
