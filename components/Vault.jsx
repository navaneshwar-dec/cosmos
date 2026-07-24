'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss, Grabber } from './OverlayDismiss';
import { deriveKey, encryptJson, decryptJson, makeVerifier, checkVerifier, randomSaltB64, generatePassword } from '../lib/vaultCrypto';

const inputStyle = { width: '100%', background: '#1a1a1a', border: '1px solid #262626', borderRadius: 10, padding: '13px 14px', color: '#e8e8e8', fontSize: 15, outline: 'none' };
const label = { fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 };
const primaryBtn = ok => ({ width: '100%', padding: '14px', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: ok ? 'pointer' : 'default', background: ok ? '#7c3aed' : '#222', color: ok ? '#fff' : '#555' });

function Copyable({ value, mono }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: '4px 10px', color: copied ? '#4ade80' : '#888', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function Vault({ open, onClose }) {
  const [phase, setPhase]   = useState('loading');   // loading | create | unlock | ready
  const [meta, setMeta]     = useState(null);
  const [key, setKey]       = useState(null);        // in-memory CryptoKey (never persisted)
  const [entries, setEntries] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);

  const [pw, setPw]         = useState('');
  const [pw2, setPw2]       = useState('');

  const [view, setView]     = useState('list');      // list | detail | form
  const [selected, setSelected] = useState(null);    // { entry, secret }
  const [form, setForm]     = useState(null);        // { id?, title, url, username, password, notes }
  const [reveal, setReveal] = useState(false);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // fetch meta on open
  useEffect(() => {
    if (!open) return;
    setPhase('loading'); setError(null); setPw(''); setPw2('');
    fetch('/api/vault/meta').then(r => r.json()).then(m => {
      setMeta(m);
      setPhase(m.exists ? 'unlock' : 'create');
    }).catch(() => setError('Could not reach the vault'));
  }, [open]);

  function lock() { setKey(null); setEntries(null); setView('list'); setSelected(null); setPw(''); setPhase(meta?.exists ? 'unlock' : 'create'); }

  async function loadEntries() {
    const rows = await fetch('/api/vault/entries').then(r => r.json());
    setEntries(rows);
  }

  async function createVault() {
    if (pw.length < 8 || pw !== pw2 || busy) return;
    setBusy(true); setError(null);
    try {
      const salt = randomSaltB64();
      const k = await deriveKey(pw, salt);
      const v = await makeVerifier(k);
      const res = await fetch('/api/vault/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salt, verifier_iv: v.iv, verifier_ct: v.ct }) });
      if (!res.ok) throw new Error('setup failed');
      setKey(k); setMeta({ exists: true, salt, verifier_iv: v.iv, verifier_ct: v.ct });
      setEntries([]); setPhase('ready'); setPw(''); setPw2('');
    } catch { setError('Could not create the vault'); }
    setBusy(false);
  }

  async function unlock() {
    if (!pw || busy) return;
    setBusy(true); setError(null);
    try {
      const k = await deriveKey(pw, meta.salt);
      const ok = await checkVerifier(k, meta.verifier_iv, meta.verifier_ct);
      if (!ok) { setError('Wrong master password'); setBusy(false); return; }
      setKey(k); setPw(''); setPhase('ready');
      await loadEntries();
    } catch { setError('Unlock failed'); }
    setBusy(false);
  }

  async function openEntry(entry) {
    try {
      const secret = await decryptJson(key, entry.blob_iv, entry.blob_ct);
      setSelected({ entry, secret }); setReveal(false); setView('detail');
    } catch { setError('Could not decrypt this entry'); }
  }

  function newEntry() { setForm({ title: '', url: '', username: '', password: '', notes: '' }); setView('form'); }
  function editEntry() { const { entry, secret } = selected; setForm({ id: entry.id, title: entry.title, url: entry.url ?? '', ...secret }); setView('form'); }

  async function saveForm() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const blob = await encryptJson(key, { username: form.username, password: form.password, notes: form.notes });
    const body = JSON.stringify({ title: form.title.trim(), url: form.url.trim(), blob_iv: blob.iv, blob_ct: blob.ct });
    if (form.id) {
      const saved = await fetch(`/api/vault/entries/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }).then(r => r.json());
      setEntries(prev => prev.map(e => e.id === saved.id ? saved : e));
    } else {
      const saved = await fetch('/api/vault/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(r => r.json());
      setEntries(prev => [...(prev ?? []), saved].sort((a, b) => a.title.localeCompare(b.title)));
    }
    setBusy(false); setView('list'); setSelected(null); setForm(null);
  }

  async function deleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
    setView('list'); setSelected(null);
    await fetch(`/api/vault/entries/${id}`, { method: 'DELETE' });
  }

  useOverlayDismiss(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: '#0d0d0d', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)', animation: 'fadeIn 0.15s ease' }}>
      <Grabber onClose={onClose} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        {view !== 'list' && phase === 'ready' ? (
          <button onClick={() => { setView('list'); setSelected(null); setForm(null); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
        ) : null}
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.4, flex: 1 }}>🔒 Vault</span>
        {phase === 'ready' && <button onClick={lock} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 18, padding: '6px 13px', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Lock</button>}
        <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', border: 'none', borderRadius: '50%', color: '#888', fontSize: 18, cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {phase === 'loading' && <div style={{ textAlign: 'center', color: '#444', padding: '80px 20px' }}>Opening…</div>}

        {/* Create vault */}
        {phase === 'create' && (
          <div style={{ maxWidth: 420, margin: '0 auto', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Create your vault</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, background: '#1a1206', border: '1px solid #f59e0b33', borderRadius: 10, padding: '12px 14px' }}>
              ⚠ Your master password encrypts everything on your device. It is <b>never sent to the server</b> and <b>cannot be recovered</b> — if you forget it, the vault is unreadable. Choose something strong and memorable.
            </div>
            <div><div style={label}>Master password</div><input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle} autoFocus /></div>
            <div><div style={label}>Confirm</div><input type="password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && createVault()} style={inputStyle} /></div>
            {pw && pw.length < 8 && <div style={{ fontSize: 12, color: '#f59e0b' }}>At least 8 characters</div>}
            {pw2 && pw !== pw2 && <div style={{ fontSize: 12, color: '#ef4444' }}>Passwords don't match</div>}
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
            <button onClick={createVault} disabled={pw.length < 8 || pw !== pw2 || busy} style={primaryBtn(pw.length >= 8 && pw === pw2 && !busy)}>{busy ? 'Creating…' : 'Create vault'}</button>
          </div>
        )}

        {/* Unlock */}
        {phase === 'unlock' && (
          <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', fontSize: 44 }}>🔐</div>
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>Unlock your vault</div>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock()} placeholder="Master password" style={inputStyle} autoFocus />
            {error && <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{error}</div>}
            <button onClick={unlock} disabled={!pw || busy} style={primaryBtn(!!pw && !busy)}>{busy ? 'Unlocking…' : 'Unlock'}</button>
          </div>
        )}

        {/* Unlocked — list */}
        {phase === 'ready' && view === 'list' && (
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 40px' }}>
            {!entries && <div style={{ color: '#444', textAlign: 'center', padding: 40 }}>Loading…</div>}
            {entries && entries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗝️</div>
                <div style={{ fontSize: 15, color: '#444', fontWeight: 600 }}>No passwords yet</div>
                <div style={{ fontSize: 13, color: '#2e2e2e', marginTop: 6 }}>Add your first one below</div>
              </div>
            )}
            {entries && entries.map(e => (
              <button key={e.id} onClick={() => openEntry(e)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', marginBottom: 7, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#7c3aed22', border: '1px solid #7c3aed33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>{e.title[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  {e.url && <div style={{ fontSize: 12, color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</div>}
                </div>
                <span style={{ color: '#333', fontSize: 16 }}>›</span>
              </button>
            ))}
            {entries && (
              <button onClick={newEntry} style={{ width: '100%', marginTop: 8, padding: '13px', background: 'transparent', border: '1px dashed #2a2a2a', borderRadius: 12, color: '#a78bfa', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add password</button>
            )}
          </div>
        )}

        {/* Detail */}
        {phase === 'ready' && view === 'detail' && selected && (
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '18px 18px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{selected.entry.title}</div>
            {selected.entry.url && <a href={/^https?:\/\//.test(selected.entry.url) ? selected.entry.url : `https://${selected.entry.url}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#38bdf8', wordBreak: 'break-all' }}>{selected.entry.url}</a>}

            {selected.secret.username && (
              <div><div style={label}>Username</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, ...inputStyle, wordBreak: 'break-all' }}>{selected.secret.username}</div>
                  <Copyable value={selected.secret.username} />
                </div>
              </div>
            )}

            <div><div style={label}>Password</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, ...inputStyle, fontFamily: 'monospace', wordBreak: 'break-all', letterSpacing: reveal ? 0 : 2 }}>{reveal ? selected.secret.password : '•'.repeat(Math.min(selected.secret.password?.length || 8, 20))}</div>
                <button onClick={() => setReveal(r => !r)} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: '4px 10px', color: '#888', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{reveal ? 'Hide' : 'Show'}</button>
                <Copyable value={selected.secret.password} />
              </div>
            </div>

            {selected.secret.notes && (
              <div><div style={label}>Notes</div>
                <div style={{ ...inputStyle, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{selected.secret.notes}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={editEntry} style={{ flex: 1, padding: '13px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, color: '#e0e0e0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => deleteEntry(selected.entry.id)} style={{ padding: '13px 18px', background: '#1a0505', border: '1px solid #ef444433', borderRadius: 12, color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}

        {/* Add / edit form */}
        {phase === 'ready' && view === 'form' && form && (
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '18px 18px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><div style={label}>Title</div><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Gmail" style={inputStyle} autoFocus /></div>
            <div><div style={label}>Website / URL</div><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="mail.google.com" style={inputStyle} /></div>
            <div><div style={label}>Username / email</div><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" style={inputStyle} /></div>
            <div><div style={label}>Password</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="off" style={{ ...inputStyle, fontFamily: 'monospace' }} />
                <button onClick={() => setForm({ ...form, password: generatePassword(20) })} title="Generate strong password" style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', borderRadius: 10, padding: '0 14px', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>⚡ Gen</button>
              </div>
            </div>
            <div><div style={label}>Notes</div><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} /></div>
            <button onClick={saveForm} disabled={!form.title.trim() || busy} style={primaryBtn(!!form.title.trim() && !busy)}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
