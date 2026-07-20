'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Modal from './Modal';
import { istDateKey } from '../lib/dates';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const TEAL = '#14b8a6';
const DAYS = [['mon', 'M'], ['tue', 'T'], ['wed', 'W'], ['thu', 'T'], ['fri', 'F'], ['sat', 'S'], ['sun', 'S']];

function daysLabel(days) {
  if (!days || days.length === 0) return 'Every day';
  if (days.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every(d => days.includes(d))) return 'Weekdays';
  const map = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  return days.map(d => map[d]).join(', ');
}
const fmtTime = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const hh = h % 12 || 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; };

function RoutineForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [time, setTime]   = useState(initial?.time ?? '');
  const [days, setDays]   = useState(initial?.days ?? []);

  function toggleDay(d) { setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: '#141414', border: '1px solid #262626', borderRadius: 12 }}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Routine (e.g. Meditate)" autoFocus
        style={{ background: '#1a1a1a', border: '1px solid #252525', borderRadius: 9, padding: '11px 12px', color: '#e8e8e8', fontSize: 15, outline: 'none' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #252525', borderRadius: 9, padding: '10px 12px', color: time ? '#e8e8e8' : '#555', fontSize: 14, outline: 'none', colorScheme: 'dark' }} />
        {time && <button onClick={() => setTime('')} style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #2a2a2a', borderRadius: 9, padding: '9px 12px', cursor: 'pointer' }}>Anytime</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setDays([])} style={chip(days.length === 0, TEAL)}>Every day</button>
        <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 2px' }} />
        {DAYS.map(([d, l]) => (
          <button key={d} onClick={() => toggleDay(d)} style={{ ...chip(days.includes(d), TEAL), width: 30, padding: '6px 0', textAlign: 'center' }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => title.trim() && onSave({ title: title.trim(), time: time || null, days })} disabled={!title.trim()}
          style={{ flex: 1, padding: '11px', background: title.trim() ? TEAL : '#222', border: 'none', borderRadius: 10, color: title.trim() ? '#04211d' : '#555', fontSize: 14, fontWeight: 800, cursor: title.trim() ? 'pointer' : 'default' }}>Save</button>
        {onCancel && <button onClick={onCancel} style={{ padding: '11px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, color: '#666', fontSize: 14, cursor: 'pointer' }}>Cancel</button>}
      </div>
    </div>
  );
}

export default function RoutineManager({ open, onClose }) {
  const today = istDateKey();
  const { data: routines, mutate } = useSWR(open ? '/api/routines' : null, fetcher);
  const { data: myday, mutate: mutateDay } = useSWR(open ? `/api/myday?date=${today}` : null, fetcher);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);

  const todayRoutines = (myday?.items ?? []).filter(i => i.type === 'routine');
  const list = routines ?? [];

  async function toggle(id, done) {
    mutateDay(d => ({ ...d, items: d.items.map(i => i.type === 'routine' && i.id === id ? { ...i, done } : i) }), { revalidate: false });
    await fetch('/api/routines/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routineId: id, date: today, done }) });
  }
  async function add(data) {
    setAdding(false);
    await fetch('/api/routines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    mutate(); mutateDay();
  }
  async function save(id, data) {
    setEditId(null);
    await fetch(`/api/routines/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    mutate(); mutateDay();
  }
  async function del(id) {
    mutate(prev => prev.filter(r => r.id !== id), { revalidate: false });
    await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    mutateDay();
  }

  return (
    <Modal open={open} onClose={onClose} title="Daily Routine">
      <div style={{ padding: '12px 18px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {todayRoutines.length > 0 && (
          <div>
            <div style={SECTION}>Today · tap to mark done</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayRoutines.map(r => (
                <button key={r.id} onClick={() => toggle(r.id, !r.done)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, cursor: 'pointer', textAlign: 'left', opacity: r.done ? 0.55 : 1 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${r.done ? TEAL : '#333'}`, background: r.done ? TEAL : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04211d', fontSize: 11, fontWeight: 800 }}>{r.done && '✓'}</span>
                  {r.time && <span style={{ fontSize: 11, color: '#777', width: 62, flexShrink: 0 }}>{fmtTime(r.time)}</span>}
                  <span style={{ flex: 1, fontSize: 14, color: r.done ? '#555' : '#e8e8e8', textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={SECTION}>All routines</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(r => editId === r.id ? (
              <RoutineForm key={r.id} initial={r} onSave={d => save(r.id, d)} onCancel={() => setEditId(null)} />
            ) : (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL, flexShrink: 0 }} />
                <button onClick={() => setEditId(r.id)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                  <div style={{ fontSize: 14, color: '#e8e8e8' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{fmtTime(r.time) ? `${fmtTime(r.time)} · ` : ''}{daysLabel(r.days)}</div>
                </button>
                <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 20, padding: '0 4px', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}>×</button>
              </div>
            ))}
          </div>

          {adding ? (
            <div style={{ marginTop: 8 }}><RoutineForm onSave={add} onCancel={() => setAdding(false)} /></div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 8, width: '100%', padding: '12px', background: 'transparent', border: '1px dashed #2a2a2a', borderRadius: 11, color: '#14b8a6', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add routine</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

const SECTION = { fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 };
const chip = (active, color) => ({
  flexShrink: 0, padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${active ? color + '88' : '#2a2a2a'}`, background: active ? color + '22' : 'transparent', color: active ? color : '#888',
});
