'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss, Grabber } from './OverlayDismiss';
import { signIn } from 'next-auth/react';
import useSWR from 'swr';
import Modal from './Modal';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const isFolder = m => m === FOLDER_MIME;

function fmtSize(n) {
  if (!n) return '';
  const b = Number(n);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function iconFor(item) {
  if (isFolder(item.mimeType)) return '📁';
  const m = item.mimeType || '';
  const e = (item.fileExtension || '').toLowerCase();
  if (m.startsWith('image/')) return '🖼️';
  if (m.startsWith('video/')) return '🎬';
  if (m.startsWith('audio/')) return '🎵';
  if (m === 'application/pdf' || e === 'pdf') return '📕';
  if (['doc', 'docx'].includes(e)) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📗';
  if (['zip', 'rar', '7z'].includes(e)) return '🗜️';
  return '📄';
}

export default function Files({ open, onClose }) {
  const [path, setPath]   = useState([{ id: null, name: 'cosmos' }]);   // breadcrumb stack; root id = null
  const [query, setQuery] = useState('');
  const [busy, setBusy]   = useState(null);        // 'upload' | 'folder' | null
  const [menuFor, setMenuFor] = useState(null);    // item id whose menu is open
  const [creating, setCreating] = useState(false); // new-folder input visible
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(null);  // { id, name }
  const [error, setError] = useState(null);
  const fileInput = useRef(null);

  const current = path[path.length - 1];
  const searching = query.trim().length > 0;
  const key = !open ? null
    : searching ? `/api/files?q=${encodeURIComponent(query.trim())}`
    : `/api/files?folder=${current.id ?? ''}`;
  const { data, mutate, isLoading } = useSWR(key, fetcher);

  useEffect(() => {
    if (open) { setPath([{ id: null, name: 'cosmos' }]); setQuery(''); setMenuFor(null); setCreating(false); setError(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useOverlayDismiss(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  const connected = data ? data.connected !== false : true;
  const items = searching ? (data?.results ?? []) : (data?.files ?? []);

  function openItem(item) {
    setMenuFor(null);
    if (isFolder(item.mimeType)) {
      setQuery('');
      setPath(p => [...p, { id: item.id, name: item.name }]);
    } else {
      download(item);
    }
  }
  function download(item) {
    setMenuFor(null);
    const a = document.createElement('a');
    a.href = `/api/files/download?id=${item.id}`;
    a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function crumbTo(i) { setQuery(''); setPath(p => p.slice(0, i + 1)); }

  async function onFilesPicked(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy('upload'); setError(null);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        if (current.id) fd.append('parent', current.id);
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`${f.name}: upload failed (${res.status})`);
      }
      await mutate();
    } catch (err) { setError(err.message); }
    setBusy(null);
  }

  async function createFolder() {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    setBusy('folder'); setError(null);
    try {
      const res = await fetch('/api/files/folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent: current.id || null }),
      });
      if (!res.ok) throw new Error('Create folder failed');
      setCreating(false); setNewName('');
      await mutate();
    } catch (err) { setError(err.message); }
    setBusy(null);
  }

  async function doRename() {
    const name = renaming.name.trim();
    if (!name) { setRenaming(null); return; }
    try {
      const res = await fetch('/api/files', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renaming.id, name }),
      });
      if (!res.ok) throw new Error('Rename failed');
      setRenaming(null); await mutate();
    } catch (err) { setError(err.message); setRenaming(null); }
  }

  async function doDelete(item) {
    setMenuFor(null);
    if (!confirm(`Move "${item.name}" to Google Drive trash?`)) return;
    try {
      const res = await fetch(`/api/files?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await mutate();
    } catch (err) { setError(err.message); }
  }

  return createPortal(
    <div style={overlay} onClick={() => setMenuFor(null)}>
      <Grabber onClose={onClose} />
      {/* Top bar */}
      <div style={topbar}>
        <button onClick={onClose} aria-label="Close files" style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>Files</span>
          <span style={{ fontSize: 17 }}>📁</span>
        </div>
      </div>

      {!connected ? (
        <ConnectDrive />
      ) : (
        <>
          {/* Search */}
          <div style={{ padding: '12px 14px 6px' }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your files…"
              style={{ width: '100%', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' }} />
          </div>

          {/* Breadcrumb */}
          {!searching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 16px 8px', overflowX: 'auto', flexShrink: 0 }}>
              {path.map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {i > 0 && <span style={{ color: 'var(--text-faint)', margin: '0 2px' }}>›</span>}
                  <button onClick={() => crumbTo(i)} style={{ background: 'none', border: 'none', color: i === path.length - 1 ? 'var(--text)' : 'var(--text-dim)', fontSize: 13, fontWeight: i === path.length - 1 ? 700 : 500, padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {i === 0 ? '📁 cosmos' : c.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <div style={{ margin: '0 16px 8px', padding: '9px 12px', background: '#2a0a0a', border: '1px solid #ef444455', borderRadius: 10, color: '#f87171', fontSize: 12 }}>{error}</div>}

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 12px 96px' }}>
            {(isLoading || !data) && <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>{[.5, .4, .3].map((o, i) => <div key={i} style={{ height: 56, background: 'var(--glass-1)', borderRadius: 14, opacity: o }} />)}</div>}

            {data && items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-faint)' }}>
                <div style={{ fontSize: 42, marginBottom: 10 }}>{searching ? '🔍' : '🗂️'}</div>
                <div style={{ fontSize: 14 }}>{searching ? 'No files match that.' : 'This folder is empty — upload a file or make a folder.'}</div>
              </div>
            )}

            {items.map(item => (
              <div key={item.id} style={{ position: 'relative' }}>
                <div style={row} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openItem(item)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', padding: 0 }}>
                    <span style={{ fontSize: 24, flexShrink: 0, width: 30, textAlign: 'center' }}>{iconFor(item)}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                        {isFolder(item.mimeType) ? 'Folder' : [fmtSize(item.size), fmtDate(item.modifiedTime)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                  <button onClick={() => setMenuFor(menuFor === item.id ? null : item.id)} aria-label="Actions" style={{ ...iconBtn, width: 32, height: 32, background: 'none', border: 'none', color: 'var(--text-dim)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                </div>
                {menuFor === item.id && (
                  <div style={menu} onClick={e => e.stopPropagation()}>
                    {!isFolder(item.mimeType) && <button style={menuItem} onClick={() => download(item)}>⬇  Download</button>}
                    <button style={menuItem} onClick={() => { setMenuFor(null); setRenaming({ id: item.id, name: item.name }); }}>✏️  Rename</button>
                    <button style={{ ...menuItem, color: '#f87171' }} onClick={() => doDelete(item)}>🗑  Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom action bar */}
          {!searching && (
            <div style={actionBar}>
              {creating ? (
                <div style={{ display: 'flex', gap: 8, width: '100%' }} onClick={e => e.stopPropagation()}>
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createFolder()}
                    placeholder="Folder name" style={{ flex: 1, background: 'var(--glass-1)', border: '1px solid var(--border-hi)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' }} />
                  <button onClick={createFolder} disabled={busy === 'folder'} style={primaryBtn}>Create</button>
                  <button onClick={() => { setCreating(false); setNewName(''); }} style={ghostBtn}>Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setCreating(true)} style={ghostBtn}>
                    <span style={{ fontSize: 16 }}>📁</span> New folder
                  </button>
                  <button onClick={() => fileInput.current?.click()} disabled={busy === 'upload'} style={primaryBtn}>
                    {busy === 'upload' ? 'Uploading…' : '⬆  Upload'}
                  </button>
                </>
              )}
            </div>
          )}
          <input ref={fileInput} type="file" multiple hidden onChange={onFilesPicked} />
        </>
      )}

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename" maxWidth={420}>
        {renaming && (
          <div style={{ padding: '16px 20px 20px' }}>
            <input autoFocus value={renaming.name} onChange={e => setRenaming(r => ({ ...r, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && doRename()}
              style={{ width: '100%', background: 'var(--glass-1)', border: '1px solid var(--border-hi)', borderRadius: 12, padding: '13px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={doRename} style={{ ...primaryBtn, flex: 1 }}>Save</button>
              <button onClick={() => setRenaming(null)} style={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>,
    document.body,
  );
}

function ConnectDrive() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
      <div style={{ fontSize: 54, marginBottom: 16 }}>📁</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Connect Google Drive</div>
      <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 320, marginBottom: 26 }}>
        Your files live in a <b>cosmos</b> folder inside your own Google Drive. cosmos can only ever see files it creates there — never the rest of your Drive.
      </div>
      <button onClick={() => signIn('google', { callbackUrl: '/' })}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
        Connect with Google
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 18 }}>You'll be asked to approve Drive access once.</div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, zIndex: 620, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', backgroundImage: 'var(--aura)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', animation: 'fadeIn 0.2s ease' };
const topbar = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 };
const iconBtn = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', flexShrink: 0 };
const row = { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, padding: '11px 12px', marginBottom: 8 };
const menu = { position: 'absolute', right: 12, top: 52, zIndex: 5, background: 'rgba(28,26,40,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--border-hi)', borderRadius: 12, padding: 6, minWidth: 150, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' };
const menuItem = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', fontSize: 14, padding: '10px 12px', borderRadius: 8, cursor: 'pointer' };
const actionBar = { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 8, padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))', background: 'rgba(12,11,20,0.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: '1px solid var(--border)' };
const primaryBtn = { padding: '12px 18px', background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 };
const ghostBtn = { display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 };
