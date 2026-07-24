'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss, Grabber } from './OverlayDismiss';
import useSWR from 'swr';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const MOODS = ['😄', '🙂', '😌', '😐', '😕', '😢', '😡', '😰', '😴', '🤩', '🥰', '🤔'];

function ymd(d) {
  // local-date components (NOT toISOString, which is UTC and drifts a day in +offset zones like IST)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function isToday(dateStr) { return dateStr === ymd(new Date()); }
function longDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function wordCount(s) { const t = s.trim(); return t ? t.split(/\s+/).length : 0; }

export default function Diary({ open, onClose }) {
  const today = ymd(new Date());
  const [activeDate, setActiveDate] = useState(today);
  const [body, setBody]   = useState('');
  const [mood, setMood]   = useState(null);
  const [status, setStatus] = useState('idle');   // idle | saving | saved
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');

  const loadedRef = useRef({ date: null, body: '', mood: null });   // last server-synced snapshot
  const saveTimer = useRef(null);
  const taRef = useRef(null);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // reset to today each time the diary is opened
  useEffect(() => { if (open) { setActiveDate(today); setListOpen(false); setQuery(''); } }, [open]); // eslint-disable-line

  // list of all entries (for the browse panel) — cached via SWR
  const { data: entries, mutate: mutateList } = useSWR(open ? '/api/diary' : null, fetcher);

  // search results (only when querying)
  const { data: results } = useSWR(
    open && listOpen && query.trim() ? `/api/diary?q=${encodeURIComponent(query.trim())}` : null,
    fetcher,
  );

  // load the active day's entry whenever the date changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('idle');
    fetch(`/api/diary?date=${activeDate}`).then(r => r.json()).then(row => {
      if (cancelled) return;
      const b = row?.body ?? ''; const m = row?.mood ?? null;
      setBody(b); setMood(m);
      loadedRef.current = { date: activeDate, body: b, mood: m };
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, activeDate]);

  const persist = useCallback((nextBody, nextMood) => {
    setStatus('saving');
    fetch('/api/diary', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: activeDate, mood: nextMood, body: nextBody }),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(() => { loadedRef.current = { date: activeDate, body: nextBody, mood: nextMood }; setStatus('saved'); mutateList(); })
      .catch(() => setStatus('idle'));
  }, [activeDate, mutateList]);

  // debounced auto-save on body/mood change (skip if unchanged from server snapshot)
  function scheduleSave(nextBody, nextMood) {
    const snap = loadedRef.current;
    if (snap.date === activeDate && nextBody === snap.body && nextMood === snap.mood) { setStatus('idle'); return; }
    setStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(nextBody, nextMood), 800);
  }

  function onBodyChange(e) { const v = e.target.value; setBody(v); scheduleSave(v, mood); }
  function onMoodPick(m) { const next = mood === m ? null : m; setMood(next); scheduleSave(body, next); }

  // flush a pending save when closing
  function handleClose() {
    clearTimeout(saveTimer.current);
    const snap = loadedRef.current;
    if (!(snap.date === activeDate && body === snap.body && mood === snap.mood)) persist(body, mood);
    onClose();
  }

  function goDay(n) {
    const next = addDays(activeDate, n);
    if (next > today) return;   // no future entries
    // flush current before switching
    clearTimeout(saveTimer.current);
    const snap = loadedRef.current;
    if (!(snap.date === activeDate && body === snap.body && mood === snap.mood)) persist(body, mood);
    setActiveDate(next);
  }

  function openEntry(dateStr) { setActiveDate(dateStr); setListOpen(false); setQuery(''); }

  useOverlayDismiss(open, handleClose);

  if (!open || typeof document === 'undefined') return null;

  const words = wordCount(body);
  const atToday = isToday(activeDate);
  const shown = query.trim() ? (results ?? []) : (entries ?? []);

  const statusText = status === 'saving' ? 'Saving…'
    : status === 'saved' ? `Saved ✓${words ? ` · ${words} word${words === 1 ? '' : 's'}` : ''}`
    : words ? `${words} word${words === 1 ? '' : 's'}` : '';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 620, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', backgroundImage: 'var(--aura)',
      paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <Grabber onClose={handleClose} />
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={handleClose} aria-label="Close diary" style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>Diary</span>
          <span style={{ fontSize: 18 }}>📖</span>
        </div>
        <button onClick={() => setListOpen(v => !v)} aria-label="Browse past entries" style={{ ...iconBtn, color: listOpen ? 'var(--accent-soft)' : '#8a86a0' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        </button>
      </div>

      {listOpen ? (
        /* ── Browse / search panel ── */
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 14px 40px' }}>
          <input
            autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search your entries…"
            style={{ width: '100%', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', color: 'var(--text)', fontSize: 15, outline: 'none', marginBottom: 14 }}
          />
          {shown.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{query.trim() ? '🔍' : '🌙'}</div>
              <div style={{ fontSize: 14 }}>{query.trim() ? 'No entries match that.' : 'No entries yet — today is a good day to start.'}</div>
            </div>
          )}
          {shown.map(en => {
            const d = en.entry_date.slice(0, 10);
            const preview = (en.body || '').trim().replace(/\s+/g, ' ').slice(0, 90);
            return (
              <button key={en.id} onClick={() => openEntry(d)} style={{
                display: 'flex', gap: 12, width: '100%', textAlign: 'left', alignItems: 'flex-start',
                background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 15px', marginBottom: 9,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0, width: 26, textAlign: 'center' }}>{en.mood || '·'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {shortDate(d)}{isToday(d) && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: 'var(--accent-soft)', letterSpacing: 1 }}>TODAY</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preview || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Empty</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Writing surface ── */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 10px', flexShrink: 0 }}>
            <button onClick={() => goDay(-1)} aria-label="Previous day" style={navArrow(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.4 }}>{atToday ? 'Today' : longDate(activeDate)}</div>
              {atToday && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{longDate(activeDate)}</div>}
            </div>
            <button onClick={() => goDay(1)} disabled={atToday} aria-label="Next day" style={navArrow(!atToday)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {/* Mood row */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 14px 12px', flexShrink: 0, WebkitOverflowScrolling: 'touch' }}>
            {MOODS.map(m => (
              <button key={m} onClick={() => onMoodPick(m)} aria-label={`Mood ${m}`} style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: 12, fontSize: 20, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: mood === m ? 'var(--glass-hi)' : 'var(--glass-1)',
                border: `1px solid ${mood === m ? 'var(--accent-soft)' : 'var(--border)'}`,
                boxShadow: mood === m ? '0 0 12px var(--accent-glow)' : 'none',
                filter: mood && mood !== m ? 'grayscale(0.6) opacity(0.7)' : 'none',
                transition: 'all 0.15s',
              }}>{m}</button>
            ))}
          </div>

          {/* Body */}
          <textarea
            ref={taRef} value={body} onChange={onBodyChange}
            placeholder={atToday ? 'What happened today? How did it feel?' : 'Write about this day…'}
            style={{
              flex: 1, width: '100%', resize: 'none', outline: 'none', border: 'none',
              background: 'transparent', color: 'var(--text)', fontSize: 16, lineHeight: 1.7,
              padding: '4px 18px 18px', WebkitOverflowScrolling: 'touch', fontFamily: 'inherit',
            }}
          />

          {/* Status footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: status === 'saving' ? '#f59e0b' : status === 'saved' ? '#4ade80' : 'var(--text-faint)', boxShadow: status === 'saved' ? '0 0 8px #4ade8088' : 'none', transition: 'background 0.2s' }} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{statusText || 'Autosaves as you write'}</span>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

const iconBtn = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', flexShrink: 0 };
const navArrow = enabled => ({ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, color: enabled ? 'var(--text-dim)' : 'var(--text-faint)', opacity: enabled ? 1 : 0.4, flexShrink: 0, cursor: enabled ? 'pointer' : 'default' });
