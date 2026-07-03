'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import BottomSheet from './BottomSheet';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const TABS = ['Overview', 'Accounts', 'Review', 'Transactions'];

const ACCOUNT_COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#0d9488', '#ec4899'];

function AddAccountSheet({ open, onClose, onSaved }) {
  const [name, setName]     = useState('');
  const [type, setType]     = useState('credit_card');
  const [issuer, setIssuer] = useState('');
  const [last4, setLast4]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(''); setType('credit_card'); setIssuer(''); setLast4(''); } }, [open]);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const color = ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)];
    const res = await fetch('/api/finance/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type, issuer: issuer.trim(), last4: last4.trim(), color }),
    });
    const account = await res.json();
    setSaving(false);
    onSaved(account);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Account">
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

        <button onClick={save} disabled={!name.trim() || saving} style={{
          marginTop: 4, padding: '14px', borderRadius: 12, border: 'none',
          background: name.trim() ? '#7c3aed' : '#222', color: name.trim() ? '#fff' : '#555',
          fontSize: 15, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default',
        }}>{saving ? 'Saving…' : 'Add Account'}</button>
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
  const [step, setStep]     = useState('pick');
  const [file, setFile]     = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [error, setError]   = useState(null);
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) { setStep('pick'); setFile(null); setPreview(null); setMapping(null); setError(null); setResult(null); }
  }, [open]);

  async function onFilePicked(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setBusy(true); setError(null);
    const fd = new FormData();
    fd.append('file', f);
    fd.append('accountId', account.id);
    const res = await fetch('/api/finance/import', { method: 'POST', body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Could not read file'); return; }
    setPreview(data);
    setMapping(data.mapping);
    setStep('mapping');
  }

  async function commit() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('accountId', account.id);
    fd.append('mapping', JSON.stringify(mapping));
    const res = await fetch('/api/finance/import/commit', { method: 'POST', body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Import failed'); return; }
    setResult(data);
    setStep('result');
    onImported?.();
  }

  const mappingComplete = mapping && mapping.date && mapping.description &&
    (mapping.amountMode === 'split' ? (mapping.debit || mapping.credit) : mapping.amount);

  return (
    <BottomSheet open={open} onClose={onClose} title={`Import — ${account?.name ?? ''}`}>
      <div style={{ padding: '14px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {step === 'pick' && (
          <>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>Choose a CSV or Excel export from this account. Nothing is categorized yet — you'll tag transactions afterward in Review.</div>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '28px 16px', borderRadius: 14, border: '1px dashed #2a2a2a', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 28 }}>📄</span>
              <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{busy ? 'Reading file…' : 'Tap to choose a file'}</span>
              <input type="file" accept=".csv,.xls,.xlsx" onChange={onFilePicked} disabled={busy} style={{ display: 'none' }} />
            </label>
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
          </>
        )}

        {step === 'mapping' && preview && mapping && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555' }}>
              <span>{preview.totalRows} rows found</span>
              <span style={{ padding: '2px 8px', borderRadius: 10, background: preview.mappingSource === 'saved' ? '#16a34a22' : '#7c3aed22', color: preview.mappingSource === 'saved' ? '#4ade80' : '#a78bfa', fontWeight: 700, fontSize: 11 }}>
                {preview.mappingSource === 'saved' ? '✓ Remembered mapping' : 'Auto-guessed — please confirm'}
              </span>
            </div>

            <ColumnSelect label="Date column" value={mapping.date} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, date: v }))} />
            <ColumnSelect label="Description column" value={mapping.description} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, description: v }))} />

            <div>
              <div style={FIELD_LABEL}>Amount format</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 'single', l: 'Single Amount column' }, { v: 'split', l: 'Separate Debit/Credit' }].map(o => (
                  <button key={o.v} onClick={() => setMapping(m => ({ ...m, amountMode: o.v }))} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${mapping.amountMode === o.v ? '#7c3aed55' : '#2a2a2a'}`,
                    background: mapping.amountMode === o.v ? '#7c3aed22' : '#161616',
                    color: mapping.amountMode === o.v ? '#a78bfa' : '#666',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            {mapping.amountMode === 'single' ? (
              <ColumnSelect label="Amount column" value={mapping.amount} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, amount: v }))} />
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><ColumnSelect label="Debit column" value={mapping.debit} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, debit: v }))} /></div>
                <div style={{ flex: 1 }}><ColumnSelect label="Credit column" value={mapping.credit} headers={preview.headers} onChange={v => setMapping(m => ({ ...m, credit: v }))} /></div>
              </div>
            )}

            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}

            <button onClick={commit} disabled={!mappingComplete || busy} style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: mappingComplete ? '#7c3aed' : '#222', color: mappingComplete ? '#fff' : '#555',
              fontSize: 15, fontWeight: 700, cursor: mappingComplete ? 'pointer' : 'default',
            }}>{busy ? 'Importing…' : `Import ${preview.totalRows} rows`}</button>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{result.imported} transactions imported</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 8, lineHeight: 1.6 }}>
                {result.duplicates > 0 && <>{result.duplicates} duplicate{result.duplicates === 1 ? '' : 's'} skipped<br /></>}
                {result.skipped > 0 && <>{result.skipped} row{result.skipped === 1 ? '' : 's'} couldn't be read<br /></>}
                Head to Review to start tagging.
              </div>
            </div>
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
              </div>
              <button onClick={() => setImportAccount(a)} style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 10, border: '1px solid #2a2a2a',
                background: 'transparent', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Import</button>
              <button onClick={() => deleteAccount(a.id)} style={{ background: 'none', border: 'none', color: '#2e2e2e', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#2e2e2e'}>×</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setAddOpen(true)} style={{
        width: '100%', padding: '14px', borderRadius: 12, border: '1px dashed #2a2a2a',
        background: 'transparent', color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>+ Add Account</button>

      <AddAccountSheet open={addOpen} onClose={() => setAddOpen(false)} onSaved={account => mutate(prev => [account, ...(prev ?? [])], { revalidate: false })} />
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

function TagSheet({ transaction, categories, onClose, onTagged }) {
  const [remember, setRemember] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setRemember(true); }, [transaction?.id]);

  async function pick(categoryId) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/finance/transactions/${transaction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, rememberMerchant: remember }),
    });
    const data = await res.json();
    setSaving(false);
    onTagged(transaction.id, data.bulkApplied ?? 0);
  }

  return (
    <BottomSheet open={!!transaction} onClose={onClose} title="Tag Transaction">
      {transaction && (
        <div style={{ padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: '14px 16px', background: '#161616', border: '1px solid #1e1e1e', borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', wordBreak: 'break-word' }}>{transaction.description}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: transaction.amount < 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>{amountLabel(transaction.amount)}</span>
              <span style={{ fontSize: 12, color: '#555' }}>· {transaction.date}</span>
              <span style={{ fontSize: 12, color: '#555' }}>· {transaction.account_name}</span>
            </div>
          </div>

          <CategoryPicker categories={categories} onPick={pick} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
            Always tag "{transaction.merchant_key || transaction.description}" this way
          </label>
        </div>
      )}
    </BottomSheet>
  );
}

function ReviewTab() {
  const { data: queue, mutate } = useSWR('/api/finance/transactions?uncategorized=1', fetcher);
  const { data: categories } = useSWR('/api/finance/categories', fetcher);
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

      {categories && <TagSheet transaction={active} categories={categories} onClose={() => setActiveId(null)} onTagged={onTagged} />}
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

function OverviewTab({ onGoToReview }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [accountId, setAccountId] = useState(null);
  const { data: accounts } = useSWR('/api/finance/accounts', fetcher);
  const { data: overview } = useSWR(
    `/api/finance/overview?month=${month}${accountId ? `&accountId=${accountId}` : ''}`, fetcher
  );

  const maxCategoryTotal = overview?.categoryBreakdown?.[0]?.total ?? 0;

  return (
    <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AccountFilterChips accounts={accounts} selected={accountId} onChange={setAccountId} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} style={{ width: 30, height: 30, borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontSize: 15 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{monthLabel(month)}</span>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} style={{ width: 30, height: 30, borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', fontSize: 15 }}>›</button>
      </div>

      {!overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 60, background: '#1a1a1a', borderRadius: 12, opacity: o }} />)}
        </div>
      )}

      {overview && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: '16px', background: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: 14 }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Spent</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', marginTop: 6 }}>₹{overview.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ flex: 1, padding: '16px', background: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: 14 }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Income</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', marginTop: 6 }}>₹{overview.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          {overview.uncategorizedCount > 0 && (
            <button onClick={onGoToReview} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '13px 16px', borderRadius: 12, border: '1px solid #f59e0b33', background: '#f59e0b14', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>{overview.uncategorizedCount} transaction{overview.uncategorizedCount === 1 ? '' : 's'} need tagging</span>
              <span style={{ color: '#fbbf24', fontSize: 13 }}>Review →</span>
            </button>
          )}

          <div>
            <div style={{ fontSize: 12, color: '#555', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>By category</div>
            {overview.categoryBreakdown.length === 0 ? (
              <div style={{ fontSize: 13, color: '#333', textAlign: 'center', padding: '24px 0' }}>No categorized spend this month</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {overview.categoryBreakdown.map(c => (
                  <div key={c.category_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: '#ccc', fontWeight: 600 }}>{c.category_name}</span>
                      <span style={{ color: '#888' }}>₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${maxCategoryTotal ? (c.total / maxCategoryTotal) * 100 : 0}%`, background: '#7c3aed', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TransactionsTab() {
  const [accountId, setAccountId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState(null);

  const { data: accounts } = useSWR('/api/finance/accounts', fetcher);
  const { data: categories } = useSWR('/api/finance/categories', fetcher);
  const query = new URLSearchParams({ ...(accountId ? { accountId } : {}), ...(q.trim() ? { q: q.trim() } : {}) }).toString();
  const { data: transactions, mutate } = useSWR(`/api/finance/transactions${query ? `?${query}` : ''}`, fetcher);

  const active = transactions?.find(t => t.id === activeId) ?? null;

  function onTagged(id) {
    mutate();
    setActiveId(null);
  }

  return (
    <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, overflowX: 'auto' }}><AccountFilterChips accounts={accounts} selected={accountId} onChange={setAccountId} /></div>
        <button onClick={() => setSearchOpen(o => !o)} style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: searchOpen ? '#7c3aed22' : 'transparent', border: `1px solid ${searchOpen ? '#7c3aed55' : '#2a2a2a'}`, color: searchOpen ? '#a78bfa' : '#444', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>

      {searchOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '0 12px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search transactions…" autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8e8e8', fontSize: 14, padding: '10px 0' }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>}
        </div>
      )}

      {!transactions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 58, background: '#1a1a1a', borderRadius: 12, opacity: o }} />)}
        </div>
      )}

      {transactions && transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🔍</div>
          <div style={{ fontSize: 15, color: '#444', fontWeight: 600 }}>No transactions found</div>
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transactions.map(t => (
            <button key={t.id} onClick={() => setActiveId(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#555' }}>{t.date} · {t.account_name}</span>
                  {t.category_name ? (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#7c3aed14', color: '#a78bfa' }}>
                      {t.parent_category_name ? `${t.parent_category_name} · ` : ''}{t.category_name}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#f59e0b14', color: '#fbbf24' }}>Uncategorized</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#f87171' : '#4ade80', flexShrink: 0 }}>{amountLabel(t.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {categories && <TagSheet transaction={active} categories={categories} onClose={() => setActiveId(null)} onTagged={onTagged} />}
    </div>
  );
}

export default function Finances() {
  const [tab, setTab] = useState('Accounts');

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
      {tab === 'Overview' && <OverviewTab onGoToReview={() => setTab('Review')} />}
      {tab === 'Review' && <ReviewTab />}
      {tab === 'Transactions' && <TransactionsTab />}
    </div>
  );
}
