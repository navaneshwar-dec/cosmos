'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import useSWR from 'swr';
import Markdown from './Markdown';
import { useOverlayDismiss, Grabber } from './OverlayDismiss';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
function relTime(s) {
  const d = (Date.now() - new Date(s.replace(' ', 'T') + 'Z').getTime()) / 1000;
  if (d < 60) return 'now'; if (d < 3600) return `${Math.floor(d / 60)}m`; if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const MODELS = [
  { id: 'gemini',         label: 'Gemini',         hint: 'cloud', dot: '#4285F4' },
  { id: 'qwen2.5:72b',    label: 'Qwen2.5 72B',    hint: 'local · finance', dot: '#14b8a6' },
  { id: 'llama3.1:8b',    label: 'Llama 3.1 8B',   hint: 'local', dot: '#14b8a6' },
  { id: 'deepseek-r1:8b', label: 'DeepSeek-R1 8B', hint: 'local', dot: '#14b8a6' },
];
const TOOL_LABEL = { get_today: 'My Day', get_tasks: 'Tasks', get_work: 'Work', get_gym: 'Gym', get_routine: 'Routine', query_finance: 'Finance' };

function textOf(m)  { return m.parts.filter(p => p.type === 'text').map(p => p.text).join(''); }
function toolsOf(m) {
  return m.parts
    .filter(p => p.type?.startsWith('tool-') || p.type === 'dynamic-tool')
    .map(p => p.type === 'dynamic-tool' ? p.toolName : p.type.slice(5));
}
// the SQL the finance tool generated + ran (surfaced so you can see the query)
function financeSqlOf(m) {
  const out = [];
  for (const p of m.parts) {
    const name = p.type === 'dynamic-tool' ? p.toolName : (p.type?.startsWith('tool-') ? p.type.slice(5) : null);
    if (name !== 'query_finance') continue;
    const o = p.output || p.result;
    if (o?.sql) out.push({ sql: o.sql, rowCount: o.rowCount, rows: o.rows });
    else if (o?.error) out.push({ error: o.error });
  }
  return out;
}

// Turn a query result into a simple bar chart when it looks chartable: a label column +
// a numeric column, a handful of rows. (Router pattern — the model returns data, we render.)
const AMOUNT_RE = /amount|spent|spend|total|income|balance|paid|cost|debit|credit|sum|value/i;
function chartFromRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 24) return null;
  const keys = Object.keys(rows[0] || {});
  if (keys.length < 2) return null;
  const isNum = k => rows.every(r => r[k] == null || typeof r[k] === 'number');
  const numCols = keys.filter(isNum);
  if (!numCols.length) return null;
  const valueKey = numCols.slice().sort((a, b) => (AMOUNT_RE.test(b) ? 1 : 0) - (AMOUNT_RE.test(a) ? 1 : 0))[0];
  const labelKey = keys.find(k => k !== valueKey && !isNum(k)) || keys.find(k => k !== valueKey);
  if (!labelKey) return null;
  const data = rows.map(r => ({ label: String(r[labelKey] ?? ''), value: Math.abs(Number(r[valueKey]) || 0) })).filter(d => d.label !== '');
  if (data.length < 2 || Math.max(...data.map(d => d.value)) === 0) return null;
  data.sort((a, b) => b.value - a.value);
  return { data: data.slice(0, 12), isAmount: AMOUNT_RE.test(valueKey), valueKey };
}
function fmtChartVal(n, isAmount) {
  if (!isAmount) return Math.round(n).toLocaleString('en-IN');
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(a / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (a >= 1e5) return `₹${(a / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  return `₹${Math.round(a).toLocaleString('en-IN')}`;
}

function MiniBars({ chart }) {
  const max = Math.max(...chart.data.map(d => d.value)) || 1;
  return (
    <div style={{ marginBottom: 8, padding: '12px 12px 10px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {chart.data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmtChartVal(d.value, chart.isAmount)}</span>
          </div>
          <div style={{ height: 7, background: 'var(--glass-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, (d.value / max) * 100)}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Assistant({ open, onClose, finance = false, persist = false }) {
  const availableModels = finance ? MODELS.filter(m => m.id !== 'gemini') : MODELS;
  const [model, setModel] = useState(finance ? 'qwen2.5:72b' : 'gemini');
  const [modelOpen, setModelOpen] = useState(false);
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const modelRef = useRef(model); modelRef.current = model;
  const financeRef = useRef(finance); financeRef.current = finance;
  const chatIdRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/assistant/chat',
      // inject the currently-selected model + whether this is the finance assistant
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, model: modelRef.current, finance: financeRef.current } }),
    }),
  });
  const busy = status === 'submitted' || status === 'streaming';
  const current = availableModels.find(m => m.id === model) || availableModels[0];

  // chat history — persisted (Neon) only for the general assistant; the finance
  // assistant is ephemeral so finance data is never stored anywhere.
  const { data: chats, mutate: mutateChats } = useSWR(open && persist ? '/api/assistant/chats' : null, fetcher);

  async function saveChat(msgs) {
    if (!persist || !msgs?.length) return;
    let id = chatIdRef.current;
    if (!id) { id = (crypto.randomUUID?.() || String(Date.now())); chatIdRef.current = id; }
    const first = msgs.find(m => m.role === 'user');
    const title = (first ? textOf(first) : 'New chat').trim().slice(0, 60) || 'New chat';
    await fetch(`/api/assistant/chats/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, model: modelRef.current, messages: msgs }) });
    mutateChats();
  }
  // save after each completed exchange (general assistant only)
  useEffect(() => { if (persist && status === 'ready' && messages.length > 0) saveChat(messages); }, [status]); // eslint-disable-line

  function newChat() { chatIdRef.current = null; setMessages([]); setHistoryOpen(false); }
  async function openChat(id) {
    const c = await fetch(`/api/assistant/chats/${id}`).then(r => r.json()).catch(() => null);
    if (!c) return;
    chatIdRef.current = c.id;
    setMessages(c.messages || []);
    if (c.model) setModel(c.model);
    setHistoryOpen(false);
  }
  async function deleteChat(id) {
    await fetch(`/api/assistant/chats/${id}`, { method: 'DELETE' });
    if (chatIdRef.current === id) newChat();
    mutateChats();
  }
  async function renameChat(id, title) {
    await fetch(`/api/assistant/chats/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    mutateChats();
  }

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useOverlayDismiss(open, onClose);

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }
  function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
  function grow(e) { const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; setInput(t.value); }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 620, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', backgroundImage: 'var(--aura)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', animation: 'fadeIn 0.2s ease' }}>
      <Grabber onClose={onClose} />
      {/* Header + model switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close assistant" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>{finance ? 'Finance' : 'Assistant'}</span>
        <span style={{ fontSize: 15 }}>{finance ? '₹' : '✨'}</span>
        {persist && (
          <button onClick={() => setHistoryOpen(true)} title="Chat history" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        )}
        <button onClick={newChat} title="New chat" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setModelOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: current.dot }} />
            {current.label}
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{current.hint}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {modelOpen && (
            <>
              <div onClick={() => setModelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
              <div style={{ position: 'absolute', right: 0, top: 40, zIndex: 5, background: 'rgba(28,26,40,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--border-hi)', borderRadius: 12, padding: 6, minWidth: 190, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                {availableModels.map(m => (
                  <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: model === m.id ? 'var(--glass-hi)' : 'none', border: 'none', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.hint}</span>
                    {model === m.id && <span style={{ color: 'var(--accent-soft)' }}>✓</span>}
                  </button>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-faint)', padding: '6px 12px 2px', lineHeight: 1.4 }}>Local models stay on your Mac and can answer Finance questions. Gemini is cloud — it never sees Finance.</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 14px 8px', minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 15, color: 'var(--text-dim)', fontWeight: 600 }}>{finance ? 'Ask about your spending, income & categories' : 'Ask about your day, tasks, work, or gym'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              {(finance ? ['How much did I spend last month?', 'Top 3 categories this year', 'Income vs spend this month'] : ["What's on today?", 'Any overdue tasks?', 'What P1s are open?']).map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 14px', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const tools = m.role === 'assistant' ? [...new Set(toolsOf(m))] : [];
          const sqls = m.role === 'assistant' ? financeSqlOf(m) : [];
          const text = textOf(m);
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{ maxWidth: '86%' }}>
                {tools.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {tools.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-soft)', background: '#7c3aed18', border: '1px solid #7c3aed44', borderRadius: 6, padding: '2px 7px' }}>🔧 {TOOL_LABEL[t] || t}</span>)}
                  </div>
                )}
                {sqls.map((s, i) => s.sql ? (
                  <details key={i} style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--glass-1)' }}>
                    <summary style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-faint)', padding: '6px 10px', cursor: 'pointer', listStyle: 'none' }}>◦ SQL{s.rowCount != null ? ` · ${s.rowCount} row${s.rowCount === 1 ? '' : 's'}` : ''}</summary>
                    <pre style={{ margin: 0, padding: '9px 11px', borderTop: '1px solid var(--border)', overflowX: 'auto', fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-dim)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.sql}</pre>
                  </details>
                ) : s.error ? (
                  <div key={i} style={{ marginBottom: 6, fontSize: 11.5, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444433', borderRadius: 10, padding: '7px 10px' }}>⚠ {s.error}</div>
                ) : null)}
                {sqls.map((s, i) => { const chart = s.rows ? chartFromRows(s.rows) : null; return chart ? <MiniBars key={`c${i}`} chart={chart} /> : null; })}
                {(text || m.role === 'user') && (
                  <div style={{ padding: '11px 14px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.55, wordBreak: 'break-word', whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal', background: m.role === 'user' ? 'var(--accent)' : 'var(--glass-2)', color: m.role === 'user' ? '#fff' : 'var(--text)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>
                    {m.role === 'user' ? text : <Markdown text={text} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {status === 'submitted' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '13px 16px', borderRadius: 16, background: 'var(--glass-2)', border: '1px solid var(--border)', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)', animation: `blink 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {error && <div style={{ margin: '0 auto 12px', maxWidth: 480, padding: '10px 14px', background: '#2a0a0a', border: '1px solid #ef444455', borderRadius: 12, color: '#f87171', fontSize: 12.5 }}>{error.message || 'Something went wrong.'}</div>}
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: 'var(--glass-1)', border: '1px solid var(--border-hi)', borderRadius: 18, padding: '6px 6px 6px 14px' }}>
          <textarea ref={taRef} value={input} onChange={grow} onKeyDown={onKey} rows={1}
            placeholder={`Message ${current.label}…`}
            style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15, lineHeight: 1.4, padding: '7px 0', maxHeight: 140, fontFamily: 'inherit' }} />
          <button onClick={send} disabled={!input.trim() || busy} aria-label="Send" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: 'none', background: input.trim() && !busy ? 'var(--accent)' : 'var(--glass-2)', color: input.trim() && !busy ? '#fff' : 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !busy ? 'pointer' : 'default' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <>
          <div onClick={() => setHistoryOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 'min(320px, 88%)', zIndex: 31, background: '#14141c', borderRight: '1px solid var(--border-hi)', boxShadow: '8px 0 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', animation: 'fadeIn .15s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px 10px', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Chats</span>
              <button onClick={newChat} style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 9, padding: '7px 12px', cursor: 'pointer' }}>+ New</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
              {(chats || []).length === 0 && <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '40px 12px' }}>No saved chats yet</div>}
              {(chats || []).map(c => (
                <div key={c.id} onClick={() => openChat(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', background: chatIdRef.current === c.id ? 'var(--glass-hi)' : 'transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'New chat'}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{relTime(c.updated_at)} ago</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); const t = prompt('Rename chat', c.title || ''); if (t && t.trim()) renameChat(c.id, t.trim()); }} title="Rename" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: 3 }}>✎</button>
                  <button onClick={e => { e.stopPropagation(); deleteChat(c.id); }} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 3 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes blink{0%,60%,100%{opacity:0.25}30%{opacity:1}}`}</style>
    </div>,
    document.body,
  );
}
