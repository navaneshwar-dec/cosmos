'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import BottomSheet from './BottomSheet';
import Assistant from './Assistant';
import { istMonthKey, istDateKey } from '../lib/dates';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const TABS = ['Overview', 'Accounts', 'Review', 'Transactions', 'Categories'];

const ACCOUNT_COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#0d9488', '#ec4899'];

function AddAccountSheet({ open, onClose, onSaved, account }) {
  const editing = !!account;
  const [name, setName]     = useState('');
  const [type, setType]     = useState('credit_card');
  const [issuer, setIssuer] = useState('');
  const [last4, setLast4]   = useState('');
  const [password, setPassword] = useState('');
  const [sampleFile, setSampleFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? ''); setType(account?.type ?? 'credit_card');
    setIssuer(account?.issuer ?? ''); setLast4(account?.last4 ?? '');
    setPassword(''); setSampleFile(null);
  }, [open, account]);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const color = account?.color ?? ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)];
    const payload = { name: name.trim(), type, issuer: issuer.trim(), last4: last4.trim(), color };
    if (password) payload.password = password;
    let acct;
    if (editing) {
      const res = await fetch(`/api/finance/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      acct = await res.json();
    } else {
      const res = await fetch('/api/finance/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      acct = await res.json();
    }
    if (sampleFile && acct?.id) {
      const fd = new FormData(); fd.append('file', sampleFile);
      await fetch(`/api/finance/accounts/${acct.id}/sample`, { method: 'POST', body: fd });
      acct = { ...acct, has_sample: true, sample_filename: sampleFile.name };
    }
    setSaving(false);
    onSaved(acct);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? `Manage — ${account.name}` : 'Add Source'}>
      <div style={{ padding: '14px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'credit_card', l: '💳 Credit Card' }, { v: 'bank_account', l: '🏦 Bank Account' }].map(o => (
            <button key={o.v} onClick={() => setType(o.v)} style={{
              flex: 1, padding: '12px 10px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${type === o.v ? '#7c3aed55' : '#2a2a2a'}`,
              background: type === o.v ? '#7c3aed22' : '#161616',
              color: type === o.v ? '#a78bfa' : '#666',
            }}>{o.l}</button>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HDFC Regalia"
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#e8e8e8', fontSize: 15, outline: 'none' }} autoFocus />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Issuer</div>
            <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="e.g. HDFC Bank"
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#e8e8e8', fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ width: 100 }}>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last 4</div>
            <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" inputMode="numeric"
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#e8e8e8', fontSize: 14, outline: 'none' }} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Statement file password</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
            placeholder={editing && account.has_password ? '•••••••• set — leave blank to keep' : 'Password to open this source’s statements'}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#e8e8e8', fontSize: 14, outline: 'none' }} />
          <div style={{ fontSize: 11, color: '#444', marginTop: 5 }}>Stored encrypted on your Mac; used to auto-unlock this source’s files.</div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sample statement</div>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={e => setSampleFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: '#1a1a1a', border: `1px dashed ${(sampleFile || account?.sample_filename) ? '#7c3aed66' : '#333'}`, borderRadius: 10, padding: '12px 14px', color: (sampleFile || account?.sample_filename) ? '#a78bfa' : '#666', fontSize: 14, cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sampleFile ? sampleFile.name : (account?.sample_filename || 'Upload a sample file')}</span>
          </button>
          <div style={{ fontSize: 11, color: '#444', marginTop: 5 }}>One example statement — I use it to build this source’s processor.</div>
        </div>

        {editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: '#141414', border: '1px solid #222', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>{account.has_processor ? '⚙️' : '🛠'}</span>
            <span style={{ fontSize: 12, color: account.has_processor ? '#4ade80' : '#888', lineHeight: 1.4 }}>
              {account.has_processor ? 'Processor wired — imports will auto-parse.' : 'Processor not wired yet — ask me to write it for this source.'}
            </span>
          </div>
        )}

        <button onClick={save} disabled={!name.trim() || saving} style={{
          marginTop: 4, padding: '14px', borderRadius: 12, border: 'none',
          background: name.trim() ? '#7c3aed' : '#222', color: name.trim() ? '#fff' : '#555',
          fontSize: 15, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default',
        }}>{saving ? 'Saving…' : (editing ? 'Save' : 'Add Source')}</button>
      </div>
    </BottomSheet>
  );
}

const FIELD_LABEL = { color: '#555', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 };
const SELECT_STYLE = { width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '11px 12px', color: '#e8e8e8', fontSize: 14, outline: 'none' };

function ColumnSelect({ label, value, headers, onChange }) {
  return (
    <div>
      <div style={FIELD_LABEL}>{label}</div>
      <select value={value ?? ''} onChange={e => onChange(e.target.value || null)} style={SELECT_STYLE}>
        <option value="">— none —</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

function ImportSheet({ open, onClose, account, onImported }) {
  const [step, setStep]       = useState('pick');
  const [files, setFiles]     = useState([]);
  const [preview, setPreview] = useState(null);   // preview of the FIRST file (format is assumed shared)
  const [mapping, setMapping] = useState(null);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [progress, setProgress] = useState(null); // {current,total} while a batch import runs
  const [result, setResult]   = useState(null);

  useEffect(() => {
    if (open) { setStep('pick'); setFiles([]); setPreview(null); setMapping(null); setError(null); setResult(null); setProgress(null); }
  }, [open]);

  const multi = files.length > 1;

  async function onFilesPicked(e) {
    const fs = [...(e.target.files || [])];
    if (!fs.length) return;
    setFiles(fs); setBusy(true); setError(null);
    // Preview the first file to detect the format (processor) and derive the column
    // mapping — the same format is then applied to every selected file.
    const fd = new FormData();
    fd.append('file', fs[0]);
    fd.append('accountId', account.id);
    const res = await fetch('/api/finance/import', { method: 'POST', body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Could not read file'); return; }
    setPreview(data);
    if (data.processor) { setStep('confirm'); return; }   // processor source → skip column mapping
    setMapping(data.mapping);
    setStep('mapping');
  }

  // Imports every selected file sequentially, reusing the confirmed mapping (or the
  // account's processor). Dedup on the server (txn_uid) makes overlapping statements safe.
  async function runImport() {
    setBusy(true); setError(null);
    const agg = { imported: 0, duplicates: 0, skipped: 0, files: [] };
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const fd = new FormData();
      fd.append('file', files[i]);
      fd.append('accountId', account.id);
      if (!account?.has_processor) fd.append('mapping', JSON.stringify(mapping));
      try {
        const res = await fetch('/api/finance/import/commit', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { agg.files.push({ name: files[i].name, error: data.error || 'Failed' }); continue; }
        agg.imported += data.imported || 0; agg.duplicates += data.duplicates || 0; agg.skipped += data.skipped || 0;
        agg.files.push({ name: files[i].name, imported: data.imported || 0, duplicates: data.duplicates || 0, skipped: data.skipped || 0 });
      } catch (err) {
        agg.files.push({ name: files[i].name, error: err.message || 'Failed' });
      }
    }
    setBusy(false); setProgress(null); setResult(agg); setStep('result'); onImported?.();
  }

  const mappingComplete = mapping && mapping.date && mapping.description && (
    mapping.amountMode === 'split' ? (mapping.debit || mapping.credit) :
    mapping.amountMode === 'indicator' ? (mapping.amount && mapping.indicator) :
    mapping.amount
  );

  const importLabel = busy
    ? (progress && progress.total > 1 ? `Importing ${progress.current}/${progress.total}…` : 'Importing…')
    : (multi ? `Import ${files.length} files` : `Import ${preview?.totalRows ?? ''} ${account?.has_processor ? 'transactions' : 'rows'}`);

  const filesChip = multi && (
    <div style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
      <b style={{ color: 'var(--text)' }}>{files.length} files</b> selected — the same format is applied to all, and duplicates across statements are skipped automatically. Preview below is the first file.
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={`Import — ${account?.name ?? ''}`}>
      <div style={{ padding: '14px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {step === 'pick' && (
          <>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>Choose one or more CSV/Excel exports from this account. You can select several statements at once — overlaps are de-duplicated. Nothing is categorized yet — you'll tag transactions afterward in Review.</div>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '28px 16px', borderRadius: 14, border: '1px dashed #2a2a2a', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 28 }}>📄</span>
              <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{busy ? 'Reading…' : 'Tap to choose file(s)'}</span>
              <input type="file" accept=".csv,.xls,.xlsx" multiple onChange={onFilesPicked} disabled={busy} style={{ display: 'none' }} />
            </label>
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
          </>
        )}

        {step === 'confirm' && preview?.processor && (
          <>
            {filesChip}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ padding: '3px 9px', borderRadius: 10, background: '#16a34a22', color: '#4ade80', fontWeight: 700 }}>⚙️ {preview.processor.toUpperCase()} processor</span>
              <span style={{ color: '#888' }}>{preview.totalRows} transactions{preview.skipped ? ` · ${preview.skipped} skipped` : ''}{multi ? ' · first file' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {preview.previewTxns.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '8px 10px', background: '#161616', border: '1px solid #222', borderRadius: 8 }}>
                  <span style={{ color: '#666', width: 74, flexShrink: 0 }}>{t.date}</span>
                  <span style={{ flex: 1, minWidth: 0, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                  <span style={{ color: t.amount < 0 ? '#f87171' : '#4ade80', fontWeight: 600, flexShrink: 0 }}>{t.amount < 0 ? '-' : '+'}₹{Math.abs(t.amount).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
            <button onClick={runImport} disabled={busy} style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {importLabel}
            </button>
          </>
        )}

        {step === 'mapping' && preview && mapping && (
          <>
            {filesChip}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', flexWrap: 'wrap' }}>
              <span>{preview.totalRows} rows found{multi ? ' (first file)' : ''}</span>
              <span style={{ padding: '2px 8px', borderRadius: 10, background: preview.mappingSource === 'saved' ? '#16a34a22' : '#7c3aed22', color: preview.mappingSource === 'saved' ? '#4ade80' : '#a78bfa', fontWeight: 700, fontSize: 11 }}>
                {preview.mappingSource === 'saved' ? '✓ Remembered mapping' : 'Auto-guessed — please confirm'}
              </span>
            </div>

            {!preview.headerRowConfident && (
              <div style={{ fontSize: 12, color: '#fbbf24', background: '#f59e0b14', border: '1px solid #f59e0b33', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
                Couldn't confidently find the header row in this file — double-check every column below before importing.
              </div>
            )}

            <ColumnSelect label="Date column" value={mapping.date} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, date: v }))} />
            <ColumnSelect label="Description column" value={mapping.description} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, description: v }))} />

            <div>
              <div style={FIELD_LABEL}>Amount format</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { v: 'single', l: 'Signed Amount' },
                  { v: 'split', l: 'Debit + Credit columns' },
                  { v: 'indicator', l: 'Amount + Dr/Cr label' },
                ].map(o => (
                  <button key={o.v} onClick={() => setMapping(m => ({ ...m, amountMode: o.v }))} style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${mapping.amountMode === o.v ? '#7c3aed55' : '#2a2a2a'}`,
                    background: mapping.amountMode === o.v ? '#7c3aed22' : '#161616',
                    color: mapping.amountMode === o.v ? '#a78bfa' : '#666',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            {mapping.amountMode === 'single' && (
              <ColumnSelect label="Amount column" value={mapping.amount} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, amount: v }))} />
            )}
            {mapping.amountMode === 'split' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><ColumnSelect label="Debit column" value={mapping.debit} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, debit: v }))} /></div>
                <div style={{ flex: 1 }}><ColumnSelect label="Credit column" value={mapping.credit} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, credit: v }))} /></div>
              </div>
            )}
            {mapping.amountMode === 'indicator' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><ColumnSelect label="Amount column" value={mapping.amount} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, amount: v }))} /></div>
                <div style={{ flex: 1 }}><ColumnSelect label="Debit/Credit label column" value={mapping.indicator} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, indicator: v }))} /></div>
              </div>
            )}

            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}

            <button onClick={runImport} disabled={!mappingComplete || busy} style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: mappingComplete ? '#7c3aed' : '#222', color: mappingComplete ? '#fff' : '#555',
              fontSize: 15, fontWeight: 700, cursor: mappingComplete ? 'pointer' : 'default',
            }}>{importLabel}</button>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{result.imported} transaction{result.imported === 1 ? '' : 's'} imported</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 8, lineHeight: 1.6 }}>
                {multi && <>across {result.files.length} files<br /></>}
                {result.duplicates > 0 && <>{result.duplicates} duplicate{result.duplicates === 1 ? '' : 's'} skipped<br /></>}
                {result.skipped > 0 && <>{result.skipped} row{result.skipped === 1 ? '' : 's'} couldn't be read<br /></>}
                Head to Review to start tagging.
              </div>
            </div>
            {multi && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                {result.files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '9px 11px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 9 }}>
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    {f.error
                      ? <span style={{ color: '#f87171', flexShrink: 0, fontWeight: 600 }}>⚠ {f.error}</span>
                      : <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}><b style={{ color: '#4ade80' }}>+{f.imported}</b>{f.duplicates ? ` · ${f.duplicates} dup` : ''}</span>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function AccountsTab() {
  const { data: accounts, mutate } = useSWR('/api/finance/accounts', fetcher);
  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [importAccount, setImportAccount] = useState(null);

  async function deleteAccount(id) {
    mutate(prev => prev.filter(a => a.id !== id), { revalidate: false });
    await fetch(`/api/finance/accounts/${id}`, { method: 'DELETE' });
  }

  return (
    <div style={{ padding: '16px 14px 32px' }}>
      {!accounts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 72, background: '#1a1a1a', borderRadius: 14, opacity: o }} />)}
        </div>
      )}

      {accounts && accounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 16, color: '#444', fontWeight: 600 }}>No accounts yet</div>
          <div style={{ fontSize: 13, color: '#2e2e2e', marginTop: 6 }}>Add a credit card or bank account to start importing statements</div>
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {accounts.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${a.color}22`, border: `1px solid ${a.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {a.type === 'credit_card' ? '💳' : '🏦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  {a.issuer}{a.last4 ? ` •••• ${a.last4}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[
                    { on: a.has_password, label: '🔒 Password' },
                    { on: a.has_sample, label: '📄 Sample' },
                    { on: a.has_processor, label: '⚙️ Processor' },
                  ].map(chip => (
                    <span key={chip.label} style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: chip.on ? '#16a34a1e' : '#242424', border: `1px solid ${chip.on ? '#16a34a44' : '#2e2e2e'}`, color: chip.on ? '#4ade80' : '#555' }}>{chip.on ? chip.label : chip.label + ' —'}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setEditAccount(a)} title="Manage source" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: '1px solid #2a2a2a', background: 'transparent', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              </button>
              <button onClick={() => setImportAccount(a)} style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 10, border: '1px solid #2a2a2a',
                background: 'transparent', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Import</button>
              <button onClick={() => deleteAccount(a.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#2e2e2e', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#2e2e2e'}>×</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setAddOpen(true)} style={{
        width: '100%', padding: '14px', borderRadius: 12, border: '1px dashed #2a2a2a',
        background: 'transparent', color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>+ Add Source</button>

      <AddAccountSheet open={addOpen || !!editAccount} account={editAccount} onClose={() => { setAddOpen(false); setEditAccount(null); }} onSaved={() => mutate()} />
      <ImportSheet open={!!importAccount} account={importAccount} onClose={() => setImportAccount(null)} />
    </div>
  );
}

function amountLabel(amount) {
  const abs = Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '−' : '+'}₹${abs}`;
}

function CategoryPicker({ categories, onPick }) {
  const [openTop, setOpenTop] = useState(null);
  const top  = categories.filter(c => !c.parent_id);
  const subs = parentId => categories.filter(c => c.parent_id === parentId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {top.map(c => (
          <button key={c.id} onClick={() => setOpenTop(o => o === c.id ? null : c.id)} style={{
            padding: '7px 13px', borderRadius: 18, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${openTop === c.id ? '#7c3aed55' : '#2a2a2a'}`,
            background: openTop === c.id ? '#7c3aed22' : '#161616',
            color: openTop === c.id ? '#a78bfa' : '#999',
          }}>{c.name}</button>
        ))}
      </div>

      {openTop && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e1e1e' }}>
          {subs(openTop).length === 0 && (
            <button onClick={() => onPick(openTop)} style={{
              padding: '8px 14px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff',
            }}>Tag as {top.find(c => c.id === openTop)?.name}</button>
          )}
          {subs(openTop).map(s => (
            <button key={s.id} onClick={() => onPick(s.id)} style={{
              padding: '8px 14px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid #2a2a2a', background: '#1e1e1e', color: '#ccc',
            }}>{s.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelEditor({ transaction, allLabels, onChanged }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const labels = transaction.labels ?? [];

  async function add(raw) {
    const label = String(raw).trim().slice(0, 40);
    if (!label || labels.includes(label) || busy) return;
    setBusy(true);
    await fetch(`/api/finance/transactions/${transaction.id}/labels`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
    });
    setBusy(false); setInput('');
    onChanged();
  }
  async function remove(label) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/finance/transactions/${transaction.id}/labels`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
    });
    setBusy(false);
    onChanged();
  }

  const suggestions = (allLabels ?? []).map(l => l.label).filter(l => !labels.includes(l)).slice(0, 6);

  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Labels</div>
      {labels.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {labels.map(l => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 6px 4px 10px', borderRadius: 20, background: 'rgba(167,139,250,0.14)', color: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
              {l}
              <button onClick={() => remove(l)} style={{ background: 'none', border: 'none', color: 'var(--accent-soft)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add a label…"
          onKeyDown={e => { if (e.key === 'Enter') add(input); }}
          style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
        <button onClick={() => add(input)} disabled={!input.trim()} style={{ padding: '0 15px', borderRadius: 10, border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--glass-2)', color: input.trim() ? '#fff' : 'var(--text-faint)', fontSize: 12.5, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'default' }}>Add</button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {suggestions.map(l => (
            <button key={l} onClick={() => add(l)} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 16, background: 'var(--glass-2)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>+ {l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function TagSheet({ transaction, categories, allLabels, onClose, onTagged, onMutate }) {
  const [remember, setRemember] = useState(true);
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { setRemember(true); setApplyAll(false); setNotes(transaction?.notes || ''); }, [transaction?.id]);

  const isRetag = !!transaction?.category_id;
  const merchantName = transaction?.merchant_key || transaction?.description;

  async function pick(categoryId) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/finance/transactions/${transaction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, rememberMerchant: remember, applyToAll: applyAll }),
    });
    const data = await res.json();
    setSaving(false);
    onTagged(transaction.id, data.bulkApplied ?? 0);
  }
  async function saveNotes() {
    if ((transaction?.notes || '') === notes) return;
    await fetch(`/api/finance/transactions/${transaction.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }),
    });
    onMutate?.();
  }

  const catChip = transaction?.category_name
    ? `${transaction.parent_category_name ? `${transaction.parent_category_name} · ` : ''}${transaction.category_name}`
    : null;

  return (
    <BottomSheet open={!!transaction} onClose={onClose} title={isRetag ? 'Edit Transaction' : 'Tag Transaction'}>
      {transaction && (
        <div style={{ padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: '14px 16px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>{transaction.description}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: transaction.amount < 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>{amountLabel(transaction.amount)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· {transaction.date}</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· {transaction.account_name}</span>
            </div>
            {catChip && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 8, background: 'rgba(124,58,237,0.16)', color: 'var(--accent-soft)' }}>{catChip}</span>
                <button onClick={() => pick(null)} disabled={saving} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Clear</button>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{isRetag ? 'Change category' : 'Category'}</div>
            <CategoryPicker categories={categories} onPick={pick} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
              Always tag "{merchantName}" this way
            </label>
            {isRetag && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
                Re-tag all past "{merchantName}" transactions too
              </label>
            )}
          </div>

          <LabelEditor transaction={transaction} allLabels={allLabels} onChanged={onMutate} />

          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Add a note…" rows={2}
              style={{ width: '100%', background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function CategorizeAIPanel({ onDone }) {
  const [categorizing, setCategorizing] = useState(false);
  const [progress, setProgress]         = useState(null);
  const [recent, setRecent]             = useState([]);
  const [error, setError]               = useState(null);
  const [stopped, setStopped]           = useState(false);   // dropped/cancelled mid-run → offer Resume
  const [done, setDone]                 = useState(false);
  const [cancelling, setCancelling]     = useState(false);
  const retries = useRef(0);
  const pollRef = useRef(null);

  function stopPolling() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }

  async function cancel() {
    setCancelling(true);
    try { await fetch('/api/finance/categorize/cancel', { method: 'POST' }); } catch {}
    // the run stops at the next batch boundary (or sooner — the in-flight model call is
    // aborted); the stream/poll handlers flip us into the Paused state when it lands.
  }

  // Adopt a run that's already in flight on the server (e.g. this tab was refreshed,
  // or the run outlived the tab that started it) by polling the persisted job record.
  function startPolling() {
    if (pollRef.current) return;
    setCategorizing(true); setStopped(false); setDone(false);
    pollRef.current = setInterval(async () => {
      try {
        const { job } = await fetch('/api/finance/categorize/status').then(r => r.json());
        if (!job) { stopPolling(); setCategorizing(false); return; }
        setProgress({ total: job.total, done: job.done, tagged: job.tagged });
        if (job.recent?.length) setRecent(job.recent);
        if (job.status === 'done') { stopPolling(); setCategorizing(false); setDone(true); setCancelling(false); onDone(); }
        else if (job.status === 'cancelled') { stopPolling(); setCategorizing(false); setStopped(true); setCancelling(false); onDone(); }
        else if (job.stale) { stopPolling(); setCategorizing(false); setStopped(true); onDone(); }
      } catch { /* transient — keep polling */ }
    }, 1500);
  }

  // On mount, reflect any persisted run so progress survives a refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { job } = await fetch('/api/finance/categorize/status').then(r => r.json());
        if (cancelled || !job || (job.status !== 'running' && job.status !== 'cancelled')) return;
        setProgress({ total: job.total, done: job.done, tagged: job.tagged });
        setRecent(job.recent || []);
        if (job.status === 'cancelled' || job.stale) setStopped(true); else startPolling();
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; stopPolling(); };
  }, []);

  async function run() {
    stopPolling();
    setCategorizing(true); setError(null); setStopped(false); setDone(false); setCancelling(false);
    let completed = false, wasCancelled = false;
    try {
      const res = await fetch('/api/finance/categorize', { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Failed (${res.status})`); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.complete) { completed = true; setProgress(p => ({ ...(p || {}), ...evt })); continue; }
          if (evt.cancelled) { wasCancelled = true; setProgress(p => ({ ...(p || {}), ...evt })); continue; }
          if (evt.batchError) { setError(`A batch stalled — will retry those on resume`); continue; }
          setProgress(p => ({ ...(p || {}), ...evt }));
          if (evt.justTagged?.length) setRecent(r => [...evt.justTagged, ...r].slice(0, 8));
        }
      }
    } catch (err) {
      setError(err.message || 'Categorization stopped');
    } finally {
      onDone();   // refresh the review queue with whatever got tagged
      if (completed) {
        setCategorizing(false); setDone(true); setCancelling(false); retries.current = 0;
      } else if (wasCancelled) {
        setCategorizing(false); setCancelling(false); setStopped(true); retries.current = 0;
      } else {
        // Stream ended early. The server run is resilient and may still be going —
        // adopt it via polling rather than starting a competing run. (But if the user
        // hit Stop, treat it as cancelled, not a dropped run to resume.)
        let jobState = null;
        try { const { job } = await fetch('/api/finance/categorize/status').then(r => r.json()); jobState = job; } catch {}
        if (jobState?.status === 'cancelled') { setCategorizing(false); setCancelling(false); setStopped(true); }
        else if (jobState?.status === 'running' && !jobState.stale) startPolling();
        else if (retries.current < 2) { retries.current += 1; setError(null); setTimeout(run, 1200); }
        else { setCategorizing(false); setStopped(true); }
      }
    }
  }

  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const barColor = done ? '#16a34a' : '#7c3aed';

  return (
    <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={run} disabled={categorizing} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: categorizing ? 'default' : 'pointer', textAlign: 'left', padding: 0, opacity: categorizing ? 0.75 : 1 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{categorizing ? (cancelling ? 'Stopping…' : 'Categorizing…') : (stopped ? 'Paused' : 'Categorize with AI')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Local model — nothing leaves your laptop. Safe to leave running or close the tab.</div>
          </div>
        </button>
        {categorizing && (
          <button onClick={cancel} disabled={cancelling} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 9, border: '1px solid #f8717155', background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 12.5, fontWeight: 700, cursor: cancelling ? 'default' : 'pointer', opacity: cancelling ? 0.6 : 1 }}>
            {cancelling ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>

      {progress && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: done ? '#4ade80' : 'var(--accent-soft)', fontWeight: 600 }}>
              {done ? '✓ Done' : (cancelling ? 'Stopping…' : (categorizing ? 'Working…' : 'Paused'))}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>{progress.done ?? 0}/{progress.total ?? 0} merchants · {progress.tagged ?? 0} tagged</span>
          </div>
          <div style={{ height: 6, background: 'var(--glass-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          {recent.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 96, overflow: 'hidden' }}>
              {recent.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 6, opacity: 1 - i * 0.1 }}>
                  <span style={{ color: '#4ade80' }}>✓</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{r.merchant}</span>
                  <span style={{ color: 'var(--accent-soft)', flexShrink: 0 }}>{r.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: stopped ? '#fbbf24' : '#ef4444' }}>⚠ {error}</div>}

      {stopped && (
        <button onClick={() => { retries.current = 0; run(); }} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-hi)', background: 'rgba(124,58,237,0.14)', color: 'var(--accent-soft)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ↻ Resume — pick up the remaining {progress ? Math.max(0, (progress.total ?? 0) - (progress.done ?? 0)) : ''} merchants
        </button>
      )}
    </div>
  );
}

function ReviewTab() {
  const { data: queue, mutate } = useSWR('/api/finance/transactions?uncategorized=1', fetcher);
  const { data: categories } = useSWR('/api/finance/categories', fetcher);
  const { data: allLabels } = useSWR('/api/finance/labels', fetcher);
  const [activeId, setActiveId] = useState(null);

  const active = queue?.find(t => t.id === activeId) ?? null;

  function onTagged(id, bulkApplied) {
    const removedKey = queue.find(t => t.id === id)?.merchant_key;
    const next = queue.filter(t => t.id !== id && !(bulkApplied > 0 && t.merchant_key === removedKey));
    mutate(next, { revalidate: false });
    setActiveId(next[0]?.id ?? null);
  }

  return (
    <div style={{ padding: '16px 14px 32px' }}>
      {(!queue || !categories) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 62, background: '#1a1a1a', borderRadius: 12, opacity: o }} />)}
        </div>
      )}

      {queue && categories && <CategorizeAIPanel onDone={() => mutate()} />}

      {queue && queue.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, color: '#444', fontWeight: 600 }}>All caught up</div>
          <div style={{ fontSize: 13, color: '#2e2e2e', marginTop: 6 }}>Import a statement to bring in new transactions to tag</div>
        </div>
      )}

      {queue && queue.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>{queue.length} to tag</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.map(t => (
              <button key={t.id} onClick={() => setActiveId(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: 12,
                textAlign: 'left', cursor: 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{t.date} · {t.account_name}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#f87171' : '#4ade80', flexShrink: 0 }}>{amountLabel(t.amount)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {categories && <TagSheet transaction={active} categories={categories} allLabels={allLabels} onClose={() => setActiveId(null)} onTagged={onTagged} onMutate={mutate} />}
    </div>
  );
}

function AccountFilterChips({ accounts, selected, onChange }) {
  if (!accounts || accounts.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
      <button onClick={() => onChange(null)} style={{
        flexShrink: 0, padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${!selected ? '#7c3aed55' : '#2a2a2a'}`,
        background: !selected ? '#7c3aed22' : 'transparent',
        color: !selected ? '#a78bfa' : '#555',
      }}>All accounts</button>
      {accounts.map(a => (
        <button key={a.id} onClick={() => onChange(a.id)} style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${selected === a.id ? a.color + '55' : '#2a2a2a'}`,
          background: selected === a.id ? a.color + '22' : 'transparent',
          color: selected === a.id ? a.color : '#555',
        }}>{a.name}</button>
      ))}
    </div>
  );
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CAT_COLORS = ['#a78bfa', '#5eead4', '#f59e0b', '#60a5fa', '#f472b6', '#34d399', '#fb7185', '#c084fc', '#facc15', '#38bdf8'];
function fmtINR(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '')}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '')}L`;
  return `${s}₹${Math.round(a).toLocaleString('en-IN')}`;
}
function pctDelta(cur, prev) { return prev ? Math.round(((cur - prev) / prev) * 100) : null; }
const kpiLabel = { fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 };
const ovNavBtn = { width: 32, height: 32, borderRadius: 9, background: 'var(--glass-1)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 };
const sectionLabel = { fontSize: 11, color: 'var(--text-faint)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 };

// top 5 categories + everything else folded into "Other", each with a stable color + %
function foldCats(breakdown) {
  const sorted = [...breakdown].sort((a, b) => b.total - a.total);
  const list = sorted.slice(0, 5).map((c, i) => ({ id: c.category_id, name: c.category_name, total: c.total, color: CAT_COLORS[i] }));
  const rest = sorted.slice(5).reduce((s, c) => s + c.total, 0);
  if (rest > 0) list.push({ id: 'other', name: 'Other', total: rest, color: '#6a6685' });
  const total = list.reduce((s, c) => s + c.total, 0) || 1;
  return list.map(c => ({ ...c, pct: (c.total / total) * 100 }));
}

function SpendDonut({ segments, total }) {
  let cum = 0;
  return (
    <svg width="128" height="128" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--glass-2)" strokeWidth="16" />
      <g transform="rotate(-90 70 70)" strokeWidth="16" fill="none">
        {segments.map((s, i) => {
          const dash = Math.max(0, s.pct - 0.8);
          const c = <circle key={i} cx="70" cy="70" r="54" stroke={s.color} pathLength="100" strokeDasharray={`${dash} 100`} strokeDashoffset={-cum} strokeLinecap="butt" />;
          cum += s.pct;
          return c;
        })}
      </g>
      <text x="70" y="65" textAnchor="middle" fill="var(--text-faint)" fontSize="9" letterSpacing="0.5">SPENT</text>
      <text x="70" y="84" textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="800">{fmtINR(total)}</text>
    </svg>
  );
}

function heatColor(total, max) {
  if (!total) return 'var(--glass-1)';
  // sqrt so a single huge day (e.g. a UPI transfer) doesn't wash out every normal day
  const a = (0.14 + 0.76 * Math.sqrt(Math.min(1, total / max))).toFixed(2);
  return `rgba(124,58,237,${a})`;
}

function SpendHeatmap({ month, daily }) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 = Sun (device is IST)
  const byDay = {};
  daily.forEach(d => { byDay[Number(d.date.slice(8, 10))] = d.total; });
  // scale to the 90th percentile (not the max) so outlier days saturate but the rest spread
  const sorted = daily.map(d => d.total).sort((a, b) => a - b);
  const max = Math.max(1, sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.9)] : 1);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div style={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 5, marginBottom: 5 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 700 }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 5 }}>
        {cells.map((d, i) => d === null
          ? <div key={i} />
          : <div key={i} title={byDay[d] ? `${d}: ${fmtINR(byDay[d])}` : `${d}: no spend`}
              style={{ aspectRatio: '1 / 1', borderRadius: 6, background: heatColor(byDay[d] || 0, max), border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '2px 4px' }}>
              <span style={{ fontSize: 8.5, color: byDay[d] && byDay[d] / max > 0.55 ? 'rgba(255,255,255,0.8)' : 'var(--text-faint)', fontWeight: 600 }}>{d}</span>
            </div>)}
      </div>
    </div>
  );
}

function OverviewTab({ onGoToReview, onOpenTransactions }) {
  const [month, setMonth] = useState(() => istMonthKey());
  const [accountId, setAccountId] = useState(null);
  const [jumped, setJumped] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  // jump to Transactions with this month + these filters applied
  function goTx(extra) { onOpenTransactions?.({ from: monthStartKey(month), to: monthEndKey(month), accountId, ...extra }); }
  const clickable = { cursor: 'pointer' };
  const { data: accounts } = useSWR('/api/finance/accounts', fetcher);
  const { data: overview } = useSWR(
    `/api/finance/overview?month=${month}${accountId ? `&accountId=${accountId}` : ''}`, fetcher
  );

  useEffect(() => {
    if (jumped || !overview) return;
    setJumped(true);
    if (overview.totalSpend === 0 && overview.totalIncome === 0 && overview.latestMonth && overview.latestMonth !== month) {
      setMonth(overview.latestMonth);
    }
  }, [overview, jumped, month]);

  const spentDelta = overview ? pctDelta(overview.totalSpend, overview.prevSpend) : null;
  const incomeDelta = overview ? pctDelta(overview.totalIncome, overview.prevIncome) : null;
  const prevMonthName = monthLabel(shiftMonth(month, -1)).split(' ')[0];
  const monthName = monthLabel(month).split(' ')[0];

  const folded = overview?.categoryBreakdown?.length ? foldCats(overview.categoryBreakdown) : [];
  const foldedTotal = folded.reduce((s, c) => s + c.total, 0);
  const daily = overview?.dailySpend ?? [];
  const biggest = daily.reduce((mx, d) => (d.total > (mx?.total ?? 0) ? d : mx), null);
  const [mY, mM] = month.split('-').map(Number);
  const daysInMon = new Date(mY, mM, 0).getDate();
  const todayKey = istDateKey();
  const elapsed = month === todayKey.slice(0, 7) ? Number(todayKey.slice(8, 10)) : daysInMon;
  const noSpendDays = Math.max(0, elapsed - daily.filter(d => d.total > 0).length);

  return (
    <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto', width: '100%' }}>
      {/* Month = dashboard title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} style={ovNavBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>{monthLabel(month)}</div>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} style={ovNavBtn}>›</button>
      </div>

      <AccountFilterChips accounts={accounts} selected={accountId} onChange={setAccountId} />

      <button onClick={() => setAskOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 15px', borderRadius: 14, border: '1px solid var(--border-hi)', background: 'rgba(124,58,237,0.10)', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 18 }}>✨</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent-soft)' }}>Ask about your finances</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Local model · nothing leaves your laptop · not saved</div>
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
      </button>

      <Assistant open={askOpen} onClose={() => setAskOpen(false)} finance persist={false} />

      {!overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.5, 0.3, 0.4].map((o, i) => <div key={i} style={{ height: i === 0 ? 96 : 62, background: 'var(--glass-1)', borderRadius: 16, opacity: o }} />)}
        </div>
      )}

      {overview && (
        <>
          {/* HERO: spent, with month-over-month comparison */}
          <div onClick={() => goTx({ type: 'spend' })} style={{ padding: '18px 18px 16px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 16, ...clickable }}>
            <div style={kpiLabel}>Spent this month</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, marginTop: 5 }}>{fmtINR(overview.totalSpend)}</div>
            {spentDelta != null && (
              <div style={{ marginTop: 7, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: spentDelta === 0 ? 'var(--text-faint)' : spentDelta > 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>
                  {spentDelta > 0 ? '▲' : spentDelta < 0 ? '▼' : '–'} {Math.abs(spentDelta)}%
                </span>
                <span style={{ color: 'var(--text-faint)' }}>vs {prevMonthName} ({fmtINR(overview.prevSpend)})</span>
              </div>
            )}
          </div>

          {/* context KPIs */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={() => goTx({ type: 'income' })} style={{ flex: 1, padding: '14px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, ...clickable }}>
              <div style={kpiLabel}>Money in</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>{fmtINR(overview.totalIncome)}</div>
              {incomeDelta != null && <div style={{ fontSize: 11, marginTop: 4, color: incomeDelta >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{incomeDelta > 0 ? '▲' : incomeDelta < 0 ? '▼' : '–'} {Math.abs(incomeDelta)}% vs {prevMonthName}</div>}
            </div>
            {overview.totalTransfers > 0 && (
              <div onClick={() => goTx({ categoryId: overview.transfersCategoryId })} style={{ flex: 1, padding: '14px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, ...clickable }}>
                <div style={kpiLabel}>Transfers</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#60a5fa', marginTop: 4 }}>{fmtINR(overview.totalTransfers)}</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-faint)' }}>moved, not spent</div>
              </div>
            )}
            <div onClick={() => goTx({})} style={{ flex: 1, padding: '14px', background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, ...clickable }}>
              <div style={kpiLabel}>Transactions</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{overview.txnCount}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-faint)' }}>{overview.categoryBreakdown.length} categories</div>
            </div>
          </div>

          {overview.uncategorizedCount > 0 && (
            <button onClick={onGoToReview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', borderRadius: 12, border: '1px solid #f59e0b40', background: '#f59e0b14', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>{overview.uncategorizedCount} transaction{overview.uncategorizedCount === 1 ? '' : 's'} this month need tagging</span>
              <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>Review →</span>
            </button>
          )}

          {/* Where it goes — donut + ranked legend */}
          <div>
            <div style={sectionLabel}>Where it goes</div>
            {folded.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '28px 0' }}>No categorized spend this month</div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <SpendDonut segments={folded} total={foldedTotal} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {folded.map(c => (
                    <div key={c.id} onClick={() => goTx(c.id === 'other' ? { type: 'spend' } : { type: 'spend', categoryId: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, ...clickable }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ color: 'var(--text-dim)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtINR(c.total)}</span>
                      <span style={{ color: 'var(--text-faint)', width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{Math.round(c.pct)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily rhythm — spend heatmap */}
          {daily.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ ...sectionLabel, marginBottom: 0 }}>{monthName} rhythm</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  less
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: heatColor(0.25, 1) }} />
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: heatColor(0.6, 1) }} />
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: heatColor(1, 1) }} />
                  more
                </div>
              </div>
              <SpendHeatmap month={month} daily={daily} />
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 10 }}>
                {biggest && <>Biggest: <b style={{ color: 'var(--text)' }}>{monthName} {Number(biggest.date.slice(8, 10))} · {fmtINR(biggest.total)}</b> · </>}
                {noSpendDays} no-spend day{noSpendDays === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// A styled, theme-consistent dropdown — replaces the raw OS <select> which renders
// an ugly native menu. Options may carry a `depth` for hierarchy indentation.
function GlassSelect({ value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => String(o.value) === String(value));
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--glass-2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', color: current && current.value !== '' ? 'var(--text)' : 'var(--text-faint)', fontSize: 13, cursor: 'pointer' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.label : placeholder}</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 10, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▼</span>
      </button>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 41, maxHeight: 300, overflowY: 'auto', background: '#14141c', border: '1px solid var(--border-hi)', borderRadius: 12, padding: 6, boxShadow: '0 16px 44px rgba(0,0,0,0.55)' }}>
          {options.map(o => {
            const sel = String(o.value) === String(value);
            return (
              <button key={String(o.value)} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: `8px 10px 8px ${10 + (o.depth || 0) * 16}px`, borderRadius: 8, border: 'none', background: sel ? 'rgba(124,58,237,0.20)' : 'transparent', color: sel ? 'var(--accent-soft)' : (o.depth ? 'var(--text-dim)' : 'var(--text)'), fontSize: 13, fontWeight: o.depth ? 500 : 600, cursor: 'pointer' }}>
                {o.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: o.dot, flexShrink: 0 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {o.hint != null && <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{o.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const filterLabelStyle = { fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 };
function monthStartKey(m) { return `${m}-01`; }
function monthEndKey(m) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo, 0).getDate(); return `${m}-${String(d).padStart(2, '0')}`; }

const meInput = { width: '100%', background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' };

function ManualEntrySheet({ open, onClose, categories, accounts, onSaved }) {
  const [type, setType] = useState('spend');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setType('spend'); setAmount(''); setDesc(''); setDate(istDateKey()); setCategoryId(''); setAccountId(''); setError(null); setBusy(false); } }, [open]);

  const catOpts = [{ value: '', label: 'No category' }];
  (categories?.filter(c => !c.parent_id) ?? []).forEach(t => {
    catOpts.push({ value: t.id, label: t.name });
    (categories.filter(c => c.parent_id === t.id)).forEach(s => catOpts.push({ value: s.id, label: s.name, depth: 1 }));
  });
  const acctOpts = [{ value: '', label: 'Cash (auto)' }, ...(accounts ?? []).map(a => ({ value: a.id, label: a.name }))];

  async function save() {
    const amt = Number(amount);
    if (!amt) { setError('Enter an amount'); return; }
    if (!desc.trim()) { setError('Enter what it was for'); return; }
    setBusy(true); setError(null);
    const res = await fetch('/api/finance/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amt, description: desc.trim(), date, categoryId: categoryId || null, accountId: accountId || null, type }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setBusy(false); setError(d.error || 'Could not save'); return; }
    onSaved?.();
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add entry">
      <div style={{ padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['spend', 'Spent'], ['income', 'Received']].map(([t, l]) => (
            <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`, background: type === t ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', color: type === t ? 'var(--accent-soft)' : 'var(--text-dim)' }}>{l}</button>
          ))}
        </div>
        <div>
          <div style={filterLabelStyle}>Amount (₹)</div>
          <input inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" style={{ ...meInput, fontSize: 22, fontWeight: 800 }} />
        </div>
        <div>
          <div style={filterLabelStyle}>What for</div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Auto to office, chai, groceries" style={meInput} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={filterLabelStyle}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...meInput, colorScheme: 'dark' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={filterLabelStyle}>Account</div>
            <GlassSelect value={accountId} options={acctOpts} placeholder="Cash (auto)" onChange={setAccountId} />
          </div>
        </div>
        <div>
          <div style={filterLabelStyle}>Category</div>
          <GlassSelect value={categoryId} options={catOpts} placeholder="No category" onChange={setCategoryId} />
        </div>
        {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
        <button onClick={save} disabled={busy} style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Add'}</button>
      </div>
    </BottomSheet>
  );
}

function TransactionsTab({ preset } = {}) {
  const [accountId, setAccountId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('');       // '' | 'spend' | 'income'
  const [status, setStatus] = useState('');   // '' | 'categorized' | 'uncategorized'
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [activeId, setActiveId] = useState(null);

  // apply a preset when jumping in from the Overview tiles / donut
  useEffect(() => {
    if (!preset) return;
    setAccountId(preset.accountId ?? null);
    setType(preset.type ?? '');
    setCategoryId(preset.categoryId != null ? String(preset.categoryId) : '');
    setFrom(preset.from ?? ''); setTo(preset.to ?? '');
    setStatus(preset.status ?? ''); setLabel(''); setMin(''); setMax(''); setQ('');
    setFilterOpen(true);
  }, [preset?._t]); // eslint-disable-line

  const { data: accounts, mutate: mutateAccounts } = useSWR('/api/finance/accounts', fetcher);
  const { data: categories } = useSWR('/api/finance/categories', fetcher);
  const { data: allLabels } = useSWR('/api/finance/labels', fetcher);
  const query = new URLSearchParams({
    ...(accountId ? { accountId } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(label ? { label } : {}),
    ...(type ? { type } : {}),
    ...(status === 'uncategorized' ? { uncategorized: '1' } : {}),
    ...(status === 'categorized' ? { categorized: '1' } : {}),
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
  }).toString();
  const { data: transactions, mutate } = useSWR(`/api/finance/transactions${query ? `?${query}` : ''}`, fetcher);

  // category options for the dropdown: top-levels, each followed by its indented subs
  const catSelectOptions = [{ value: '', label: 'All categories' }];
  (categories?.filter(c => !c.parent_id) ?? []).forEach(t => {
    catSelectOptions.push({ value: t.id, label: t.name });
    (categories.filter(c => c.parent_id === t.id)).forEach(s => catSelectOptions.push({ value: s.id, label: s.name, depth: 1 }));
  });
  const catName = catSelectOptions.find(o => String(o.value) === String(categoryId))?.label;

  const thisMonth = istMonthKey();
  const today = istDateKey();
  const lastMonth = shiftMonth(thisMonth, -1);
  const presets = [
    { key: 'thisMonth', label: 'This month', from: monthStartKey(thisMonth), to: today },
    { key: 'lastMonth', label: 'Last month', from: monthStartKey(lastMonth), to: monthEndKey(lastMonth) },
    { key: '3m', label: 'Last 3 mo', from: monthStartKey(shiftMonth(thisMonth, -2)), to: today },
    { key: 'year', label: 'This year', from: thisMonth.slice(0, 4) + '-01-01', to: today },
  ];
  const activePreset = presets.find(p => p.from === from && p.to === to)?.key;

  const activeChips = [];
  if (type) activeChips.push({ k: 'type', label: type === 'spend' ? 'Spending' : 'Income', clear: () => setType('') });
  if (status) activeChips.push({ k: 'status', label: status === 'uncategorized' ? 'Uncategorized' : 'Categorized', clear: () => setStatus('') });
  if (categoryId) activeChips.push({ k: 'cat', label: catName, clear: () => setCategoryId('') });
  if (label) activeChips.push({ k: 'label', label: '#' + label, clear: () => setLabel('') });
  if (from || to) activeChips.push({ k: 'date', label: activePreset ? presets.find(p => p.key === activePreset).label : (from || '…') + ' → ' + (to || '…'), clear: () => { setFrom(''); setTo(''); } });
  if (min || max) activeChips.push({ k: 'amt', label: '₹' + (min || '0') + '–' + (max || '∞'), clear: () => { setMin(''); setMax(''); } });
  const filtersActive = activeChips.length > 0;
  function clearAll() { setType(''); setStatus(''); setCategoryId(''); setLabel(''); setFrom(''); setTo(''); setMin(''); setMax(''); }

  const count = transactions?.length ?? 0;
  const outSum = transactions?.reduce((s, t) => s + (t.amount < 0 ? -t.amount : 0), 0) ?? 0;
  const inSum = transactions?.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0) ?? 0;

  const active = transactions?.find(t => t.id === activeId) ?? null;

  function onTagged(id) {
    mutate();
    setActiveId(null);
  }

  const segChip = (on) => ({ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', color: on ? 'var(--accent-soft)' : 'var(--text-dim)' });
  const presetChip = (on) => ({ flexShrink: 0, padding: '7px 12px', borderRadius: 16, fontSize: 12, fontWeight: on ? 700 : 600, cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', color: on ? 'var(--accent-soft)' : 'var(--text-dim)', whiteSpace: 'nowrap' });

  return (
    <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, overflowX: 'auto' }}><AccountFilterChips accounts={accounts} selected={accountId} onChange={setAccountId} /></div>
        <button onClick={() => setAddOpen(true)} title="Add entry" style={{ height: 34, padding: '0 12px', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>Add
        </button>
        <button onClick={() => setSearchOpen(o => !o)} style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: searchOpen ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', border: `1px solid ${searchOpen ? 'var(--accent)' : 'var(--border)'}`, color: searchOpen ? 'var(--accent-soft)' : 'var(--text-dim)', cursor: 'pointer' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button onClick={() => setFilterOpen(o => !o)} title="Filters" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (filterOpen || filtersActive) ? 'rgba(124,58,237,0.18)' : 'var(--glass-2)', border: `1px solid ${(filterOpen || filtersActive) ? 'var(--accent)' : 'var(--border)'}`, color: (filterOpen || filtersActive) ? 'var(--accent-soft)' : 'var(--text-dim)', cursor: 'pointer', position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>
          {filtersActive && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeChips.length}</span>}
        </button>
      </div>

      {searchOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search description…" autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, padding: '11px 0' }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 16 }}>×</button>}
        </div>
      )}

      {filterOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <div>
            <div style={filterLabelStyle}>Type</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setType('')} style={segChip(type === '')}>All</button>
              <button onClick={() => setType('spend')} style={segChip(type === 'spend')}>Spending</button>
              <button onClick={() => setType('income')} style={segChip(type === 'income')}>Income</button>
            </div>
          </div>

          <div>
            <div style={filterLabelStyle}>Status</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setStatus('')} style={segChip(status === '')}>All</button>
              <button onClick={() => setStatus('categorized')} style={segChip(status === 'categorized')}>Categorized</button>
              <button onClick={() => setStatus('uncategorized')} style={segChip(status === 'uncategorized')}>Uncategorized</button>
            </div>
          </div>

          <div>
            <div style={filterLabelStyle}>Category</div>
            <GlassSelect value={categoryId} options={catSelectOptions} placeholder="All categories" onChange={setCategoryId} />
          </div>

          {allLabels && allLabels.length > 0 && (
            <div>
              <div style={filterLabelStyle}>Label</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allLabels.map(l => {
                  const on = label === l.label;
                  return <button key={l.label} onClick={() => setLabel(on ? '' : l.label)} style={{ ...presetChip(on), padding: '6px 11px' }}>{l.label} <span style={{ opacity: 0.55 }}>{l.n}</span></button>;
                })}
              </div>
            </div>
          )}

          <div>
            <div style={filterLabelStyle}>When</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {presets.map(p => <button key={p.key} onClick={() => { setFrom(p.from); setTo(p.to); }} style={presetChip(activePreset === p.key)}>{p.label}</button>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ flex: 1, background: 'var(--glass-2)', border: `1px solid ${!activePreset && from ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, background: 'var(--glass-2)', border: `1px solid ${!activePreset && to ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
            </div>
          </div>

          <div>
            <div style={filterLabelStyle}>Amount</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input inputMode="numeric" value={min} onChange={e => setMin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Min ₹" style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>to</span>
              <input inputMode="numeric" value={max} onChange={e => setMax(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Max ₹" style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          {filtersActive && <button onClick={clearAll} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-soft)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '2px 0' }}>Clear all filters</button>}
        </div>
      )}

      {filtersActive && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {activeChips.map(c => (
            <button key={c.k} onClick={c.clear} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px 4px 11px', borderRadius: 16, fontSize: 12, fontWeight: 600, background: 'rgba(124,58,237,0.16)', border: '1px solid var(--border-hi)', color: 'var(--accent-soft)', cursor: 'pointer' }}>
              {c.label}<span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
            </button>
          ))}
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 2px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>{count} transaction{count === 1 ? '' : 's'}</span>
          {outSum > 0 && <span style={{ color: '#f87171' }}>−{fmtINR(outSum)}</span>}
          {inSum > 0 && <span style={{ color: '#4ade80' }}>+{fmtINR(inSum)}</span>}
        </div>
      )}

      {!transactions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 58, background: 'var(--glass-1)', borderRadius: 12, opacity: o }} />)}
        </div>
      )}

      {transactions && transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🔍</div>
          <div style={{ fontSize: 15, color: 'var(--text-faint)', fontWeight: 600 }}>No transactions match</div>
          {filtersActive && <button onClick={clearAll} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--accent-soft)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Clear all filters</button>}
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transactions.map(t => (
            <button key={t.id} onClick={() => setActiveId(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t.date} · {t.account_name}</span>
                  {t.category_name ? (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#7c3aed14', color: '#a78bfa' }}>
                      {t.parent_category_name ? `${t.parent_category_name} · ` : ''}{t.category_name}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#f59e0b14', color: '#fbbf24' }}>Uncategorized</span>
                  )}
                  {(t.labels ?? []).map(l => (
                    <span key={l} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#9490a8', border: '1px solid var(--border)' }}>{l}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#f87171' : '#4ade80', flexShrink: 0 }}>{amountLabel(t.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {categories && <TagSheet transaction={active} categories={categories} allLabels={allLabels} onClose={() => setActiveId(null)} onTagged={onTagged} onMutate={mutate} />}
      <ManualEntrySheet open={addOpen} onClose={() => setAddOpen(false)} categories={categories} accounts={accounts} onSaved={() => { mutate(); mutateAccounts(); }} />
    </div>
  );
}

function CatRow({ cat, depth = 0, impact, onRename, onDelete, onAddSub }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cat.name);
  const [confirming, setConfirming] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState('');
  useEffect(() => { setValue(cat.name); }, [cat.name]);

  async function saveRename() {
    const v = value.trim();
    if (!v || v === cat.name) { setEditing(false); setValue(cat.name); return; }
    await onRename(cat.id, v);
    setEditing(false);
  }
  async function saveSub() {
    const v = subName.trim();
    if (!v) return;
    await onAddSub(v, cat.id);
    setSubName(''); setAddingSub(false);
  }

  const iconBtn = { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--glass-2)', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, fontSize: 13 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: depth ? '8px 12px 8px 22px' : '11px 12px' }}>
        {depth > 0 && <span style={{ color: 'var(--text-faint)', fontSize: 13, marginLeft: -8 }}>↳</span>}
        {editing ? (
          <input autoFocus value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setEditing(false); setValue(cat.name); } }}
            onBlur={saveRename}
            style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 9px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        ) : cat.is_default ? (
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: depth ? 13.5 : 14.5, fontWeight: depth ? 500 : 700, overflow: 'hidden' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
        ) : (
          <button onClick={() => setEditing(true)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: depth ? 13.5 : 14.5, fontWeight: depth ? 500 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0 }}>
            {cat.name}
          </button>
        )}
        {cat.tx_count > 0 && <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 600, flexShrink: 0 }}>{cat.tx_count}</span>}
        {depth === 0 && <button title="Add subcategory" onClick={() => setAddingSub(a => !a)} style={iconBtn}>+</button>}
        {!cat.is_default && (
          <>
            <button title="Rename" onClick={() => setEditing(true)} style={iconBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button title="Delete" onClick={() => setConfirming(true)} style={{ ...iconBtn, color: '#f87171' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </>
        )}
      </div>

      {confirming && (
        <div style={{ margin: depth ? '0 12px 8px 22px' : '0 12px 10px', padding: '10px 12px', background: '#f8717112', border: '1px solid #f8717133', borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Delete <b style={{ color: 'var(--text)' }}>{cat.name}</b>?
            {impact.subs > 0 && ` Its ${impact.subs} subcategor${impact.subs === 1 ? 'y' : 'ies'} go too.`}
            {impact.txns > 0 && ` ${impact.txns} transaction${impact.txns === 1 ? '' : 's'} become uncategorized.`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <button onClick={() => setConfirming(false)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--glass-2)', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { setConfirming(false); onDelete(cat.id); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      )}

      {addingSub && (
        <div style={{ display: 'flex', gap: 8, padding: '2px 12px 10px 22px' }}>
          <input autoFocus value={subName} onChange={e => setSubName(e.target.value)} placeholder="New subcategory…"
            onKeyDown={e => { if (e.key === 'Enter') saveSub(); if (e.key === 'Escape') { setAddingSub(false); setSubName(''); } }}
            style={{ flex: 1, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          <button onClick={saveSub} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
      )}
    </div>
  );
}

function CategoriesTab() {
  const { data: categories, mutate } = useSWR('/api/finance/categories', fetcher);
  const [newTop, setNewTop] = useState('');

  const top = (categories ?? []).filter(c => !c.parent_id);
  const subs = pid => (categories ?? []).filter(c => c.parent_id === pid);

  async function createCat(name, parentId = null) {
    await fetch('/api/finance/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
    mutate();
  }
  async function renameCat(id, name) {
    await fetch(`/api/finance/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    mutate();
  }
  async function deleteCat(id) {
    await fetch(`/api/finance/categories/${id}`, { method: 'DELETE' });
    mutate();
  }
  async function addTop() {
    const v = newTop.trim();
    if (!v) return;
    setNewTop('');
    await createCat(v, null);
  }

  return (
    <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newTop} onChange={e => setNewTop(e.target.value)} placeholder="New category…"
          onKeyDown={e => { if (e.key === 'Enter') addTop(); }}
          style={{ flex: 1, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        <button onClick={addTop} style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Add</button>
      </div>

      {!categories && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0.5, 0.4, 0.5].map((o, i) => <div key={i} style={{ height: 52, background: 'var(--glass-1)', borderRadius: 12, opacity: o }} />)}</div>}

      {categories && top.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 38, marginBottom: 10, opacity: 0.5 }}>🏷️</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No categories yet</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {top.map(t => {
          const children = subs(t.id);
          const childTxns = children.reduce((s, c) => s + (c.tx_count || 0), 0);
          return (
            <div key={t.id} style={{ background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <CatRow cat={t} depth={0} impact={{ subs: children.length, txns: (t.tx_count || 0) + childTxns }}
                onRename={renameCat} onDelete={deleteCat} onAddSub={createCat} />
              {children.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {children.map(s => (
                    <CatRow key={s.id} cat={s} depth={1} impact={{ subs: 0, txns: s.tx_count || 0 }}
                      onRename={renameCat} onDelete={deleteCat} onAddSub={createCat} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Finances() {
  const [tab, setTab] = useState('Accounts');
  const [txPreset, setTxPreset] = useState(null);   // filters to apply when jumping to Transactions

  function openTransactions(preset) { setTxPreset({ ...preset, _t: Date.now() }); setTab('Transactions'); }

  return (
    <div style={{ background: '#0d0d0d', minHeight: '100%' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(13,13,13,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 14px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none',
                background: active ? '#7c3aed22' : 'transparent', color: active ? '#a78bfa' : '#555',
                fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      {tab === 'Accounts' && <AccountsTab />}
      {tab === 'Overview' && <OverviewTab onGoToReview={() => setTab('Review')} onOpenTransactions={openTransactions} />}
      {tab === 'Review' && <ReviewTab />}
      {tab === 'Transactions' && <TransactionsTab preset={txPreset} />}
      {tab === 'Categories' && <CategoriesTab />}
    </div>
  );
}
