'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import BottomSheet from './BottomSheet';
import { useOverlayDismiss, Grabber } from './OverlayDismiss';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const KINDS = [
  { v: 'visit', label: 'Visit', icon: '🩺' },
  { v: 'test', label: 'Test', icon: '🧪' },
  { v: 'prescription', label: 'Prescription', icon: '💊' },
  { v: 'note', label: 'Note', icon: '📝' },
];
const kindOf = k => KINDS.find(x => x.v === k) || KINDS[0];
const DETAIL_HINT = { visit: 'Reason, findings, advice…', test: 'Result / values summary…', prescription: 'Medicines, dosage, duration…', note: 'Anything to remember…' };

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const input = { width: '100%', background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' };
const flabel = { fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 };

// ── Add / edit a profile ───────────────────────────────────────────────────────
function ProfileSheet({ open, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [blood, setBlood] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(''); setRelation(''); setBlood(''); setDob(''); setBusy(false); } }, [open]);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await fetch('/api/health/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), relation: relation.trim() || null, blood_group: blood.trim() || null, dob: dob || null }) });
    const p = await res.json();
    setBusy(false);
    if (res.ok) { onSaved(p); onClose(); }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="New profile">
      <div style={{ padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><div style={flabel}>Name</div><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amma" style={input} /></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Mom', 'Dad', 'Self', 'Spouse', 'Child'].map(r => (
            <button key={r} onClick={() => { setRelation(r); if (!name.trim() && (r === 'Mom' || r === 'Dad' || r === 'Self')) setName(r); }} style={{ padding: '7px 13px', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${relation === r ? 'var(--accent)' : 'var(--border)'}`, background: relation === r ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', color: relation === r ? 'var(--accent-soft)' : 'var(--text-dim)' }}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><div style={flabel}>Blood group</div><input value={blood} onChange={e => setBlood(e.target.value)} placeholder="e.g. O+" style={input} /></div>
          <div style={{ flex: 1 }}><div style={flabel}>Date of birth</div><input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ ...input, colorScheme: 'dark' }} /></div>
        </div>
        <button onClick={save} disabled={!name.trim() || busy} style={{ padding: 14, borderRadius: 12, border: 'none', background: name.trim() ? 'var(--accent)' : 'var(--glass-2)', color: name.trim() ? '#fff' : 'var(--text-faint)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Add profile'}</button>
      </div>
    </BottomSheet>
  );
}

// ── Add / edit a record (+ files) ──────────────────────────────────────────────
function RecordSheet({ open, onClose, profileId, record, onChanged }) {
  const editing = !!record;
  const [kind, setKind] = useState('visit');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [doctor, setDoctor] = useState('');
  const [place, setPlace] = useState('');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState([]);   // File[] queued for a new record
  const [files, setFiles] = useState([]);        // existing files on an edited record
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setKind(record?.kind || 'visit'); setDate(record?.date ? record.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setTitle(record?.title || ''); setDoctor(record?.doctor || ''); setPlace(record?.place || ''); setDetails(record?.details || '');
    setFiles(record?.files || []); setPending([]); setErr(null); setBusy(false);
  }, [open, record?.id]);

  async function uploadTo(recordId, file) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`/api/health/records/${recordId}/files`, { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Upload failed');
    return d;
  }
  function onPick(e) {
    const picked = [...(e.target.files || [])];
    if (!picked.length) return;
    if (editing) { picked.forEach(async f => { try { const saved = await uploadTo(record.id, f); setFiles(prev => [...prev, saved]); onChanged?.(); } catch (er) { setErr(er.message); } }); }
    else setPending(prev => [...prev, ...picked]);
    e.target.value = '';
  }
  async function removeFile(fid) { setFiles(prev => prev.filter(f => f.id !== fid)); await fetch(`/api/health/files/${fid}`, { method: 'DELETE' }); onChanged?.(); }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const payload = { kind, date: date || null, title: title.trim(), doctor: doctor.trim() || null, place: place.trim() || null, details: details.trim() || null };
      let rec;
      if (editing) { const res = await fetch(`/api/health/records/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); rec = await res.json(); }
      else {
        const res = await fetch('/api/health/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, profileId }) });
        rec = await res.json();
        for (const f of pending) { try { await uploadTo(rec.id, f); } catch (er) { setErr('Saved, but a file failed: ' + er.message); } }
      }
      onChanged?.(); onClose();
    } catch (er) { setErr(er.message); } finally { setBusy(false); }
  }

  async function del() { if (!editing) return; await fetch(`/api/health/records/${record.id}`, { method: 'DELETE' }); onChanged?.(); onClose(); }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit record' : 'New record'}>
      <div style={{ padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {KINDS.map(k => (
            <button key={k.v} onClick={() => setKind(k.v)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${kind === k.v ? 'var(--accent)' : 'var(--border)'}`, background: kind === k.v ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', color: kind === k.v ? 'var(--accent-soft)' : 'var(--text-dim)' }}>{k.icon}<div style={{ fontSize: 10, marginTop: 2 }}>{k.label}</div></button>
          ))}
        </div>
        <div><div style={flabel}>Title</div><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'test' ? 'e.g. CBC, Lipid profile' : kind === 'prescription' ? 'e.g. Dr. Rao — BP meds' : 'e.g. Cardiology follow-up'} style={input} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><div style={flabel}>Date</div><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, colorScheme: 'dark' }} /></div>
          <div style={{ flex: 1 }}><div style={flabel}>Doctor</div><input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Dr. …" style={input} /></div>
        </div>
        <div><div style={flabel}>Clinic / hospital</div><input value={place} onChange={e => setPlace(e.target.value)} placeholder="Where" style={input} /></div>
        <div><div style={flabel}>Details</div><textarea value={details} onChange={e => setDetails(e.target.value)} placeholder={DETAIL_HINT[kind]} rows={3} style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} /></div>

        <div>
          <div style={flabel}>Attachments (Drive)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <span style={{ fontSize: 15 }}>📎</span>
                <a href={`/api/health/files/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--accent-soft)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{f.name}</a>
                <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            {pending.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'var(--glass-1)', border: '1px dashed var(--border-hi)', borderRadius: 10 }}>
                <span style={{ fontSize: 15 }}>📎</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-dim)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>on save</span>
                <button onClick={() => setPending(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
          <button onClick={() => fileRef.current?.click()} style={{ marginTop: 8, padding: '9px 14px', borderRadius: 10, border: '1px dashed var(--border-hi)', background: 'var(--glass-1)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Attach scan / PDF</button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={onPick} style={{ display: 'none' }} />
        </div>

        {err && <div style={{ fontSize: 12.5, color: '#f87171' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={save} disabled={!title.trim() || busy} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: title.trim() ? 'var(--accent)' : 'var(--glass-2)', color: title.trim() ? '#fff' : 'var(--text-faint)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : editing ? 'Save' : 'Add record'}</button>
          {editing && <button onClick={del} style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #ef444433', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </BottomSheet>
  );
}

export default function Medical({ open, onClose }) {
  const { data: profiles, mutate: mutateProfiles } = useSWR(open ? '/api/health/profiles' : null, fetcher);
  const [activeId, setActiveId] = useState(null);
  const [profileSheet, setProfileSheet] = useState(false);
  const [recordSheet, setRecordSheet] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  useOverlayDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { if (profiles && profiles.length && !profiles.find(p => p.id === activeId)) setActiveId(profiles[0].id); }, [profiles]); // eslint-disable-line

  const active = profiles?.find(p => p.id === activeId) || null;
  const { data: records, mutate: mutateRecords } = useSWR(active ? `/api/health/records?profileId=${active.id}` : null, fetcher);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 620, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', backgroundImage: 'var(--aura)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', animation: 'fadeIn 0.2s ease' }}>
      <Grabber onClose={onClose} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>Medical</span>
        <span style={{ fontSize: 15 }}>🩺</span>
      </div>

      {/* Profile tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {(profiles || []).map(p => {
          const on = p.id === activeId;
          return (
            <button key={p.id} onClick={() => setActiveId(p.id)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 8px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${on ? p.color : 'var(--border)'}`, background: on ? p.color + '22' : 'var(--glass-1)' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: p.color + '33', border: `1px solid ${p.color}66`, color: p.color, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.name[0]?.toUpperCase()}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: on ? p.color : 'var(--text)' }}>{p.name}</span>
                {p.relation && <span style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{p.relation}</span>}
              </span>
            </button>
          );
        })}
        <button onClick={() => setProfileSheet(true)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: '1px dashed var(--border-hi)', background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Profile</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 14px 24px', minHeight: 0 }}>
        {!profiles && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0.5, 0.4].map((o, i) => <div key={i} style={{ height: 70, background: 'var(--glass-1)', borderRadius: 14, opacity: o }} />)}</div>}

        {profiles && profiles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🩺</div>
            <div style={{ fontSize: 15, color: 'var(--text-dim)', fontWeight: 600 }}>Add a profile to start</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Keep Mom's, Dad's, and your own records separate.</div>
            <button onClick={() => setProfileSheet(true)} style={{ marginTop: 18, padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ New profile</button>
          </div>
        )}

        {active && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {active.blood_group && <>Blood {active.blood_group}</>}{active.blood_group && active.dob && ' · '}{active.dob && <>DOB {fmtDate(active.dob)}</>}
                  {!active.blood_group && !active.dob && `${records?.length ?? 0} record${(records?.length ?? 0) === 1 ? '' : 's'}`}
                </div>
              </div>
              <button onClick={() => { setEditRecord(null); setRecordSheet(true); }} style={{ padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Record</button>
            </div>

            {records && records.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>No records yet for {active.name}</div>
                <div style={{ fontSize: 12.5, marginTop: 5 }}>Add a visit, test, or prescription — attach the scans too.</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(records || []).map(r => {
                const k = kindOf(r.kind);
                return (
                  <button key={r.id} onClick={() => { setEditRecord(r); setRecordSheet(true); }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '13px 14px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer' }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{k.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(r.date)}</span>
                      </div>
                      {(r.doctor || r.place) && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{[r.doctor, r.place].filter(Boolean).join(' · ')}</div>}
                      {r.details && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.details}</div>}
                      {r.files?.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent-soft)', fontWeight: 600 }}>📎 {r.files.length} file{r.files.length === 1 ? '' : 's'}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ProfileSheet open={profileSheet} onClose={() => setProfileSheet(false)} onSaved={(p) => { mutateProfiles(); setActiveId(p.id); }} />
      <RecordSheet open={recordSheet} onClose={() => setRecordSheet(false)} profileId={active?.id} record={editRecord} onChanged={() => mutateRecords()} />
    </div>,
    document.body,
  );
}
