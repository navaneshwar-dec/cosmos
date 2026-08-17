'use client';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import { istDateKey } from '../lib/dates';
import BottomSheet from './BottomSheet';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const round = n => Math.round(Number(n) || 0);

// tz-neutral day math (no toISOString on a local date — IST-safe)
function shiftDate(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function dayLabel(key, today) {
  if (key === today) return 'Today';
  if (key === shiftDate(today, -1)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const MACROS = [
  { key: 'protein', label: 'Protein', color: '#f472b6' },
  { key: 'carbs',   label: 'Carbs',   color: '#fbbf24' },
  { key: 'fat',     label: 'Fat',     color: '#60a5fa' },
];

// ── Calorie ring (SVG) ───────────────────────────────────────────────────────
function CalorieRing({ consumed, goal, burned }) {
  const R = 74, C = 2 * Math.PI * R;
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const over = consumed > goal && goal > 0;
  const remaining = round(goal - consumed);
  const stroke = over ? '#ef4444' : 'var(--accent-soft)';
  return (
    <div style={{ position: 'relative', width: 176, height: 176, flexShrink: 0 }}>
      <svg width="176" height="176" viewBox="0 0 176 176">
        <circle cx="88" cy="88" r={R} fill="none" stroke="var(--glass-hi)" strokeWidth="12" />
        <circle cx="88" cy="88" r={R} fill="none" stroke={stroke} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 88 88)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, lineHeight: 1 }}>{round(consumed)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>of {round(goal)} kcal</div>
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: over ? '#ef4444' : 'var(--accent-soft)' }}>
          {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, color, value, goal }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}><b style={{ color: 'var(--text)' }}>{round(value)}</b>/{round(goal)}g</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--glass-hi)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Goals editor ─────────────────────────────────────────────────────────────
function GoalsSheet({ open, onClose, goals, onSaved }) {
  const [v, setV] = useState(goals);
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);
  if (open && !ref.current) { ref.current = true; setV(goals); }
  if (!open && ref.current) ref.current = false;

  const field = (k, label, unit) => (
    <label style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input type="number" inputMode="numeric" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}
          style={{ width: '100%', background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 34px 11px 12px', color: 'var(--text)', fontSize: 15, outline: 'none' }} />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-faint)' }}>{unit}</span>
      </div>
    </label>
  );
  async function save() {
    setBusy(true);
    const res = await fetch('/api/health/goals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    const g = await res.json(); setBusy(false);
    if (res.ok) { onSaved(g); onClose(); }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Daily targets">
      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {field('calories', 'Calories', 'kcal')}
        <div style={{ display: 'flex', gap: 10 }}>{field('protein', 'Protein', 'g')}{field('carbs', 'Carbs', 'g')}{field('fat', 'Fat', 'g')}</div>
        <button onClick={save} disabled={busy} style={{ marginTop: 4, padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save targets'}</button>
      </div>
    </BottomSheet>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Nutrition() {
  const today = istDateKey();
  const [date, setDate] = useState(today);
  const { data, mutate, isLoading } = useSWR(`/api/health/dashboard?date=${date}`, fetcher);
  const [text, setText] = useState('');
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const goals = data?.goals ?? { calories: 2000, protein: 120, carbs: 220, fat: 60 };
  const consumed = data?.consumed ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const burned = data?.burned ?? 0;
  const meals = data?.meals ?? [];
  const net = round(consumed.calories - burned);

  async function logFood() {
    if (!text.trim() || logging) return;
    setLogging(true); setErr(null);
    try {
      const res = await fetch('/api/health/food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_text: text.trim(), log_date: date }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not log that');
      setText(''); mutate();
    } catch (e) { setErr(e.message); }
    finally { setLogging(false); }
  }
  async function delMeal(id) {
    await fetch(`/api/health/food?id=${id}`, { method: 'DELETE' });
    mutate();
  }

  return (
    <div style={{ padding: '14px 14px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setDate(shiftDate(date, -1))} style={navBtn}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>{dayLabel(date, today)}</div>
        </div>
        <button onClick={() => date < today && setDate(shiftDate(date, 1))} disabled={date >= today} style={{ ...navBtn, opacity: date >= today ? 0.3 : 1 }}>›</button>
      </div>

      {/* Hero: calorie ring + burned/net + macros */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <CalorieRing consumed={consumed.calories} goal={goals.calories} burned={burned} />
          <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Stat icon="🍽️" label="Eaten" value={`${round(consumed.calories)} kcal`} />
            <Stat icon="🔥" label="Burned" value={`${round(burned)} kcal`} sub="from workouts" />
            <Stat icon="⚖️" label="Net" value={`${net} kcal`} accent />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
          {MACROS.map(m => <MacroBar key={m.key} label={m.label} color={m.color} value={consumed[m.key]} goal={goals[m.key]} />)}
        </div>
        <button onClick={() => setGoalsOpen(true)} style={{ marginTop: 14, alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>⚙︎ Edit daily targets</button>
      </div>

      {/* Add food */}
      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 9 }}>Log a meal</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && logFood()}
            placeholder="e.g. 2 rotis, dal, black coffee"
            style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 14px', color: 'var(--text)', fontSize: 14.5, outline: 'none' }} />
          <button onClick={logFood} disabled={!text.trim() || logging} style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (!text.trim() || logging) ? 0.5 : 1, flexShrink: 0 }}>
            {logging ? '…' : 'Log'}
          </button>
        </div>
        {logging && <div style={{ fontSize: 12, color: 'var(--accent-soft)', marginTop: 8 }}>Estimating calories & macros…</div>}
        {err && <div style={{ fontSize: 12.5, color: '#ef4444', marginTop: 8 }}>{err}</div>}
      </div>

      {/* Meal list */}
      {isLoading && !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0.5, 0.35].map((o, i) => <div key={i} style={{ height: 72, background: 'var(--glass-1)', borderRadius: 14, opacity: o }} />)}</div>
      ) : meals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🥗</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Nothing logged {date === today ? 'today' : 'this day'}</div>
          <div style={{ fontSize: 12.5, marginTop: 5 }}>Type what you ate above — cosmos estimates the rest.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meals.map(m => (
            <div key={m.id} style={{ ...card, padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{m.raw_text}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {(m.items || []).map((it, i) => (
                      <span key={i} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 9px' }}>
                        {it.name} · {round(it.calories)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{round(m.calories)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>kcal</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {MACROS.map(mac => (
                  <span key={mac.key} style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: mac.color, marginRight: 5 }} />
                    {round(m[mac.key])}g {mac.label.toLowerCase()}
                  </span>
                ))}
                <button onClick={() => delMeal(m.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: 0 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} goals={goals} onSaved={() => mutate()} />
    </div>
  );
}

function Stat({ icon, label, value, sub, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 17, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}{sub && <span style={{ marginLeft: 5 }}>· {sub}</span>}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: accent ? 'var(--accent-soft)' : 'var(--text)' }}>{value}</div>
      </div>
    </div>
  );
}

const card = { background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column' };
const navBtn = { width: 40, height: 40, borderRadius: 12, background: 'var(--glass-1)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
