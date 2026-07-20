'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const MODELS = [
  { id: 'gemini',         label: 'Gemini',         hint: 'cloud', dot: '#4285F4' },
  { id: 'llama3.1:8b',    label: 'Llama 3.1 8B',   hint: 'local', dot: '#14b8a6' },
  { id: 'deepseek-r1:8b', label: 'DeepSeek-R1 8B', hint: 'local', dot: '#14b8a6' },
];
const TOOL_LABEL = { get_today: 'My Day', get_tasks: 'Tasks', get_work: 'Work', get_gym: 'Gym', get_routine: 'Routine' };

function textOf(m)  { return m.parts.filter(p => p.type === 'text').map(p => p.text).join(''); }
function toolsOf(m) {
  return m.parts
    .filter(p => p.type?.startsWith('tool-') || p.type === 'dynamic-tool')
    .map(p => p.type === 'dynamic-tool' ? p.toolName : p.type.slice(5));
}

export default function Assistant({ open, onClose }) {
  const [model, setModel] = useState('gemini');
  const [modelOpen, setModelOpen] = useState(false);
  const [input, setInput] = useState('');
  const modelRef = useRef(model); modelRef.current = model;
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/assistant/chat',
      // inject the currently-selected model into every request
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, model: modelRef.current } }),
    }),
  });
  const busy = status === 'submitted' || status === 'streaming';
  const current = MODELS.find(m => m.id === model) || MODELS[0];

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

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
      {/* Header + model switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close assistant" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>Assistant</span>
        <span style={{ fontSize: 15 }}>✨</span>
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
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: model === m.id ? 'var(--glass-hi)' : 'none', border: 'none', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.hint}</span>
                    {model === m.id && <span style={{ color: 'var(--accent-soft)' }}>✓</span>}
                  </button>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-faint)', padding: '6px 12px 2px', lineHeight: 1.4 }}>Local models stay on your Mac. Gemini is cloud — never sees Finance.</div>
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
            <div style={{ fontSize: 15, color: 'var(--text-dim)', fontWeight: 600 }}>Ask about your day, tasks, work, or gym</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              {["What's on today?", 'Any overdue tasks?', 'What P1s are open?'].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 14px', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const tools = m.role === 'assistant' ? [...new Set(toolsOf(m))] : [];
          const text = textOf(m);
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{ maxWidth: '86%' }}>
                {tools.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {tools.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-soft)', background: '#7c3aed18', border: '1px solid #7c3aed44', borderRadius: 6, padding: '2px 7px' }}>🔧 {TOOL_LABEL[t] || t}</span>)}
                  </div>
                )}
                {(text || m.role === 'user') && (
                  <div style={{ padding: '11px 14px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: m.role === 'user' ? 'var(--accent)' : 'var(--glass-2)', color: m.role === 'user' ? '#fff' : 'var(--text)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>{text}</div>
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

      <style>{`@keyframes blink{0%,60%,100%{opacity:0.25}30%{opacity:1}}`}</style>
    </div>,
    document.body,
  );
}
