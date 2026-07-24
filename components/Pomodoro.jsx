'use client';
import { useState, useEffect, useRef } from 'react';

// Focus timer. Persists to localStorage and is TIMESTAMP-based (remaining is derived from
// a stored end-time), so it survives refresh / tab-switch / phone-lock instead of drifting.
const KEY = 'cosmos_pomodoro';
const LONG_EVERY = 4;
const DEFAULTS = { focusMin: 25, breakMin: 5, longMin: 15 };

function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
const durMs = (phase, s) => (phase === 'focus' ? s.focusMin : phase === 'long' ? s.longMin : s.breakMin) * 60000;
const phaseLabel = p => (p === 'focus' ? 'Focus' : p === 'long' ? 'Long break' : 'Break');
const fmt = ms => { const t = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// advance to the next phase; focus→(break|long) optionally auto-started, break→focus paused
function advance(s, auto) {
  if (s.phase === 'focus') {
    const completed = s.completed + 1;
    const np = completed % LONG_EVERY === 0 ? 'long' : 'break';
    const dur = durMs(np, s);
    return { ...s, phase: np, completed, running: !!auto, endAt: auto ? Date.now() + dur : null, remainingMs: dur };
  }
  return { ...s, phase: 'focus', running: false, endAt: null, remainingMs: durMs('focus', s) };
}

export default function Pomodoro({ items = [] }) {
  const [st, setSt] = useState(null);
  const [now, setNow] = useState(0);
  const [opts, setOpts] = useState(false);
  const audio = useRef(null);

  // init
  useEffect(() => {
    let s = load() || { phase: 'focus', running: false, endAt: null, remainingMs: DEFAULTS.focusMin * 60000, ...DEFAULTS, completed: 0, focusOn: null };
    if (s.focusMin == null) s = { ...DEFAULTS, ...s };
    if (s.running && s.endAt && s.endAt <= Date.now()) s = advance(s, false); // ended while away → paused on next phase
    setSt(s); setNow(Date.now());
  }, []);

  // tick while running
  useEffect(() => {
    if (!st?.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [st?.running]);

  // fire on phase end
  useEffect(() => {
    if (!st?.running || !st.endAt || now < st.endAt) return;
    chime();
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(`${phaseLabel(st.phase)} done`, { body: st.phase === 'focus' ? 'Time for a break.' : 'Back to focus.' }); } catch {}
    update(advance(st, st.phase === 'focus')); // after focus, auto-start the break
  }, [now, st]);

  if (!st) return null;

  function update(next) { setSt(next); save(next); }
  function ensureAudio() {
    try {
      if (!audio.current) audio.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.current.state === 'suspended') audio.current.resume();
    } catch {}
  }
  function chime() {
    const ctx = audio.current; if (!ctx) return;
    [880, 1174].forEach((f, i) => {
      try {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f; const t = ctx.currentTime + i * 0.28;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.start(t); o.stop(t + 0.5);
      } catch {}
    });
  }

  function start() {
    ensureAudio();
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission(); } catch {}
    update({ ...st, running: true, endAt: Date.now() + st.remainingMs });
    setNow(Date.now());
  }
  function pause() { update({ ...st, running: false, endAt: null, remainingMs: Math.max(0, st.endAt - Date.now()) }); }
  function reset() { update({ ...st, running: false, endAt: null, remainingMs: durMs(st.phase, st) }); }
  function skip() {
    const np = st.phase === 'focus' ? (((st.completed) % LONG_EVERY === LONG_EVERY - 1) ? 'long' : 'break') : 'focus';
    update({ ...st, phase: np, running: false, endAt: null, remainingMs: durMs(np, st) });
  }
  function bump(field, delta, min, max) {
    const v = Math.min(max, Math.max(min, st[field] + delta));
    const next = { ...st, [field]: v };
    if (!st.running && ((field === 'focusMin' && st.phase === 'focus') || (field === 'breakMin' && st.phase === 'break'))) next.remainingMs = durMs(st.phase, next);
    update(next);
  }

  const remaining = st.running ? Math.max(0, st.endAt - now) : st.remainingMs;
  const total = durMs(st.phase, st);
  const frac = total ? 1 - remaining / total : 0;
  const isFocus = st.phase === 'focus';
  const accent = isFocus ? '#7c3aed' : '#16a34a';
  const soft = isFocus ? '#a78bfa' : '#4ade80';

  // ring geometry
  const R = 34, C = 2 * Math.PI * R;
  const openItems = items.filter(i => !i.completed);

  return (
    <div style={{ background: 'var(--glass-1)', border: `1px solid ${st.running ? accent + '55' : 'var(--border)'}`, borderRadius: 16, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* ring + time */}
        <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--glass-2)" strokeWidth="6" />
            <circle cx="42" cy="42" r={R} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 42 42)"
              style={{ transition: st.running ? 'stroke-dashoffset .3s linear' : 'none' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>{fmt(remaining)}</div>
        </div>

        {/* label + cycles + controls */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: soft }}>{phaseLabel(st.phase)}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: (st.completed % LONG_EVERY) > i || (st.completed % LONG_EVERY === 0 && st.completed > 0 && st.phase !== 'focus') ? '#7c3aed' : 'var(--glass-hi)' }} />)}
            </div>
            <span style={{ flex: 1 }} />
            <button onClick={() => setOpts(o => !o)} title="Options" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 15, padding: 0 }}>⚙</button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={st.running ? pause : start} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              {st.running ? 'Pause' : (remaining < total ? 'Resume' : 'Start')}
            </button>
            <button onClick={reset} title="Reset" style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--glass-2)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺</button>
            <button onClick={skip} title="Skip" style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--glass-2)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⏭</button>
          </div>
        </div>
      </div>

      {/* focusing on */}
      {isFocus && openItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Focus on</span>
          <select value={st.focusOn ?? ''} onChange={e => update({ ...st, focusOn: e.target.value || null })}
            style={{ flex: 1, minWidth: 0, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 9px', color: st.focusOn ? 'var(--text)' : 'var(--text-faint)', fontSize: 12.5, outline: 'none' }}>
            <option value="">Nothing in particular</option>
            {openItems.slice(0, 30).map(i => <option key={i.id} value={i.title}>{i.title.slice(0, 60)}</option>)}
          </select>
        </div>
      )}

      {/* options */}
      {opts && (
        <div style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          {[['Focus', 'focusMin', 5, 90, 5], ['Break', 'breakMin', 1, 30, 1], ['Long', 'longMin', 5, 45, 5]].map(([lbl, f, min, max, step]) => (
            <div key={f} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{lbl}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <button onClick={() => bump(f, -step, min, max)} style={stepBtn}>−</button>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{st[f]}m</span>
                <button onClick={() => bump(f, step, min, max)} style={stepBtn}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const stepBtn = { width: 24, height: 24, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--glass-2)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' };
