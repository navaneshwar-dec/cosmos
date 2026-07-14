'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import DatePicker from './DatePicker';
import BottomSheet from './BottomSheet';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const PRIORITIES = [
  { v: 1, label: 'P1', color: '#ef4444', bg: '#ef444422', border: '#ef444455' },
  { v: 2, label: 'P2', color: '#f59e0b', bg: '#f59e0b22', border: '#f59e0b55' },
  { v: 3, label: 'P3', color: '#0ea5e9', bg: '#0ea5e922', border: '#0ea5e955' },
  { v: 4, label: 'P4', color: '#6b7280', bg: '#6b728022', border: '#6b728055' },
];
const prio = v => PRIORITIES.find(p => p.v === v) ?? PRIORITIES[1];

// ─── date helpers ──────────────────────────────────────────────────────────────
function isToday(d)    { return d ? new Date(d).toDateString() === new Date().toDateString() : false; }
function isOverdue(d)  { if (!d) return false; const x = new Date(d); return x < new Date() && !isToday(d); }
function formatDeadline(date) {
  if (!date) return null;
  const now = new Date(), d = new Date(date);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const hasTime = d.getHours() || d.getMinutes();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString())      return `Today${hasTime ? ` ${time}` : ''}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tmrw${hasTime ? ` ${time}` : ''}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (hasTime ? ` ${time}` : '');
}
function quickDate(kind) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (kind === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (kind === 'weekend') { const dts = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + dts); }
  else if (kind === 'nextweek') { const dtm = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + dtm); }
  return d.toISOString();
}

// ─── sort: P1 pinned top, then deadline asc (nulls last), then priority ─────────
function sortWork(items) {
  return [...items].sort((a, b) => {
    const aP1 = a.priority === 1, bP1 = b.priority === 1;
    if (aP1 && bP1) return new Date(a.created_at) - new Date(b.created_at);
    if (aP1) return -1;
    if (bP1) return 1;
    if (!a.deadline && !b.deadline) return a.priority - b.priority;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    const d = new Date(a.deadline) - new Date(b.deadline);
    return d !== 0 ? d : a.priority - b.priority;
  });
}

function Avatar({ name, color, size = 22 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `${color}33`, border: `1px solid ${color}66`, color, fontSize: size * 0.42, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function PriorityPills({ value, onChange, big }) {
  return (
    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
      {PRIORITIES.map(p => {
        const active = value === p.v;
        return (
          <button key={p.v} onClick={() => onChange(p.v)} style={{
            flex: 1, padding: big ? '9px 0' : '7px 0', borderRadius: 9, cursor: 'pointer',
            border: `1.5px solid ${active ? p.color : '#262626'}`, background: active ? p.bg : 'transparent',
            color: active ? p.color : '#5a5a5a', fontSize: big ? 14 : 13, fontWeight: 800, letterSpacing: 0.3, transition: 'all 0.12s',
          }}>{p.label}</button>
        );
      })}
    </div>
  );
}

// ─── Assignee chip row (used in composer + edit sheet) ──────────────────────────
function AssigneeChips({ value, people, onSelect, onAddPerson }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  async function commit() {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    const person = await onAddPerson(name);
    setDraft(''); setAdding(false);
    if (person) onSelect(person.id);
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button onClick={() => onSelect(null)} style={pchip(!value, '#7c3aed')}>Me</button>
      {people.map(p => (
        <button key={p.id} onClick={() => onSelect(p.id)} style={{ ...pchip(value === p.id, p.color), display: 'flex', alignItems: 'center', gap: 5 }}>
          <Avatar name={p.name} color={p.color} size={17} />{p.name}
        </button>
      ))}
      {adding ? (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
          onBlur={commit} placeholder="Name…"
          style={{ padding: '5px 12px', borderRadius: 16, fontSize: 13, background: '#1a1a1a', border: '1px solid #7c3aed55', outline: 'none', color: '#e8e8e8', width: 100 }} />
      ) : (
        <button onClick={() => setAdding(true)} style={{ padding: '5px 12px', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px dashed #2a2a2a', background: 'transparent', color: '#555' }}>+ Add</button>
      )}
    </div>
  );
}

// ─── Edit sheet ──────────────────────────────────────────────────────────────
const FIELD_LABEL = { fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 };

function WorkEditSheet({ item, people, onClose, onSave, onDelete, onAddPerson }) {
  const [title, setTitle]       = useState('');
  const [notes, setNotes]       = useState('');
  const [priority, setPriority] = useState(2);
  const [deadline, setDeadline] = useState(null);
  const [assignee, setAssignee] = useState(null);
  const [showCal, setShowCal]   = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title); setNotes(item.notes ?? ''); setPriority(item.priority);
    setDeadline(item.deadline ?? null); setAssignee(item.assignee_id ?? null); setShowCal(false);
  }, [item?.id]);

  function push(changes) { onSave(item.id, changes); }

  return (
    <BottomSheet open={!!item} onClose={onClose} title="Edit">
      {item && (
        <div style={{ padding: '12px 20px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title !== item.title && push({ title })}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 16, fontWeight: 600, outline: 'none' }} />

          <div>
            <div style={FIELD_LABEL}>Priority</div>
            <PriorityPills value={priority} onChange={v => { setPriority(v); push({ priority: v }); }} big />
          </div>

          <div>
            <div style={FIELD_LABEL}>Deadline {priority === 1 && <span style={{ color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· P1 stays on top regardless</span>}</div>
            <button onClick={() => setShowCal(s => !s)} style={{
              width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
              background: '#1a1a1a', border: `1px solid ${deadline ? '#7c3aed44' : '#252525'}`, color: deadline ? '#a78bfa' : '#555', fontSize: 14, fontWeight: 600,
            }}>{deadline ? formatDeadline(deadline) : 'Set a deadline'}{deadline && <span onClick={e => { e.stopPropagation(); setDeadline(null); push({ deadline: null }); }} style={{ float: 'right', opacity: 0.5 }}>×</span>}</button>
            {showCal && (
              <div style={{ marginTop: 8, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
                <DatePicker value={deadline} onChange={v => { setDeadline(v); push({ deadline: v }); }} fullWidth />
              </div>
            )}
          </div>

          <div>
            <div style={FIELD_LABEL}>Assignee</div>
            <AssigneeChips value={assignee} people={people} onAddPerson={onAddPerson}
              onSelect={id => { setAssignee(id); push({ assignee_id: id }); }} />
          </div>

          <div>
            <div style={FIELD_LABEL}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (item.notes ?? '') && push({ notes: notes.trim() || null })}
              placeholder="Add detail…" rows={3}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '12px 14px', color: '#e0e0e0', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          <button onClick={() => { onDelete(item.id); onClose(); }} style={{ padding: '13px', background: '#1a0505', border: '1px solid #ef444433', borderRadius: 12, color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
        </div>
      )}
    </BottomSheet>
  );
}

function relDays(dl) {
  const d = Math.floor((Date.now() - new Date(dl)) / 86400000);
  return d <= 0 ? 'today' : `${d}d ago`;
}

// ─── Agenda row — flat, time-bucketed (the section supplies the "when") ─────────
function AgendaRow({ item, showAssignee, onToggle, onOpen, hideDate, now }) {
  const p = prio(item.priority);
  const dl = item.deadline;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', marginBottom: 7,
      background: now ? 'rgba(239,68,68,0.10)' : '#131313',
      border: `1px solid ${now ? 'rgba(239,68,68,0.30)' : isOverdue(dl) ? '#ef444422' : '#1c1c1c'}`,
      borderRadius: 11, opacity: item.completed ? 0.45 : 1 }}>
      <button onClick={() => onToggle(item.id)} style={{ width: 21, height: 21, borderRadius: 6, border: `2px solid ${item.completed ? '#7c3aed' : '#333'}`, background: item.completed ? '#7c3aed' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>{item.completed && '✓'}</button>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: p.bg, color: p.color, flexShrink: 0 }}>{p.label}</span>
      <button onClick={() => onOpen(item)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
        fontSize: 14, color: item.completed ? '#444' : '#e8e8e8', textDecoration: item.completed ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</button>
      {showAssignee && item.assignee_id && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8a8a8a', flexShrink: 0 }}>
          <Avatar name={item.assignee_name} color={item.assignee_color} size={16} />{item.assignee_name}
        </span>
      )}
      {dl && !hideDate && (
        <span style={{ fontSize: 12, fontWeight: 600, color: isOverdue(dl) ? '#ef4444' : isToday(dl) ? '#a78bfa' : '#8a8a8a', flexShrink: 0 }}>
          {isOverdue(dl) ? `⚠ ${relDays(dl)}` : formatDeadline(dl)}
        </span>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Work() {
  const { data: rawItems } = useSWR('/api/work', fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });
  const { data: people, mutate: mutatePeople } = useSWR('/api/people', fetcher);

  const [items, setItems]     = useState([]);
  const [input, setInput]     = useState('');
  const [addPrio, setAddPrio] = useState(2);
  const [addDeadline, setAddDeadline] = useState(null);
  const [addAssignee, setAddAssignee] = useState(null);
  const [expand, setExpand]   = useState(null);  // null | 'date' | 'who'
  const [pickCal, setPickCal] = useState(false);
  const [view, setView]       = useState('mine');
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (Array.isArray(rawItems)) setItems(sortWork(rawItems)); }, [rawItems]);

  const roster = Array.isArray(people) ? people : [];

  async function addItem() {
    const title = input.trim(); if (!title) return;
    const tmp = { id: `tmp-${Date.now()}`, title, priority: addPrio, deadline: addDeadline, assignee_id: addAssignee,
      assignee_name: roster.find(p => p.id === addAssignee)?.name, assignee_color: roster.find(p => p.id === addAssignee)?.color,
      completed: false, created_at: new Date().toISOString() };
    setItems(prev => sortWork([...prev, tmp]));
    setInput(''); setExpand(null);
    const payload = { title, priority: addPrio, deadline: addDeadline, assignee_id: addAssignee };
    setAddDeadline(null); setAddAssignee(null);
    inputRef.current?.focus();
    const res = await fetch('/api/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const saved = await res.json();
    setItems(prev => sortWork(prev.map(i => i.id === tmp.id ? saved : i)));
  }

  function toggle(id) {
    const it = items.find(i => i.id === id); const now = !it.completed;
    setItems(prev => sortWork(prev.map(i => i.id === id ? { ...i, completed: now } : i)));
    fetch(`/api/work/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: now }) });
  }
  function saveEdit(id, changes) {
    setItems(prev => sortWork(prev.map(i => i.id === id ? { ...i, ...changes } : i)));
    fetch(`/api/work/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
      .then(r => r.json()).then(saved => setItems(prev => sortWork(prev.map(i => i.id === id ? saved : i))));
  }
  function del(id) {
    setItems(prev => prev.filter(i => i.id !== id));
    fetch(`/api/work/${id}`, { method: 'DELETE' });
  }
  async function addPerson(name) {
    const res = await fetch('/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) return null;
    const person = await res.json();
    mutatePeople();
    return person;
  }

  const viewFiltered = items.filter(i => {
    if (view === 'mine') return !i.assignee_id;
    if (assigneeFilter === 'me') return !i.assignee_id;
    if (assigneeFilter) return i.assignee_id === assigneeFilter;
    return true;
  });
  const active   = viewFiltered.filter(i => !i.completed);
  const doneList = viewFiltered.filter(i => i.completed);
  const p1s      = active.filter(i => i.priority === 1);
  const rest     = active.filter(i => i.priority !== 1);
  const showAssignee = view === 'team';
  const editData = editItem ? items.find(i => i.id === editItem.id) ?? editItem : null;
  const addAssigneeName = roster.find(p => p.id === addAssignee)?.name;

  // time buckets for non-P1 active items (rest is already deadline-sorted)
  const weekEnd = new Date(); weekEnd.setHours(23, 59, 59, 0); weekEnd.setDate(weekEnd.getDate() + 7);
  const bucketOf = i => {
    if (!i.deadline) return 'nodate';
    if (isOverdue(i.deadline)) return 'overdue';
    if (isToday(i.deadline)) return 'today';
    if (new Date(i.deadline) <= weekEnd) return 'week';
    return 'later';
  };
  const SECTIONS = [
    { key: 'overdue', label: 'Overdue',   color: '#ef4444' },
    { key: 'today',   label: 'Today',     color: '#a78bfa' },
    { key: 'week',    label: 'This week', color: '#555' },
    { key: 'later',   label: 'Later',     color: '#555' },
    { key: 'nodate',  label: 'No deadline', color: '#555' },
  ];
  const overdueCount = active.filter(i => i.priority !== 1 && isOverdue(i.deadline)).length;
  const todayCount   = active.filter(i => isToday(i.deadline)).length;

  const composer = (
    <div className="work-composer">
      <div style={{ background: '#161616', border: '1px solid #262626', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '10px 12px 0' }}><PriorityPills value={addPrio} onChange={setAddPrio} /></div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px 4px 14px', gap: 8 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add a priority…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8e8e8', fontSize: 15, padding: '12px 0' }} />
          {input.trim() && <button onClick={addItem} style={{ padding: '9px 18px', background: '#7c3aed', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Add</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 12px 10px' }}>
          <button onClick={() => setExpand(e => e === 'date' ? null : 'date')} style={metaBtn(addDeadline || expand === 'date')}>
            🗓 {addDeadline ? formatDeadline(addDeadline) : 'Deadline'}
            {addDeadline && <span onClick={e => { e.stopPropagation(); setAddDeadline(null); }} style={{ opacity: 0.6 }}>×</span>}
          </button>
          <button onClick={() => setExpand(e => e === 'who' ? null : 'who')} style={metaBtn(addAssignee || expand === 'who')}>
            👤 {addAssigneeName ?? 'Assignee'}
            {addAssignee && <span onClick={e => { e.stopPropagation(); setAddAssignee(null); }} style={{ opacity: 0.6 }}>×</span>}
          </button>
        </div>
        {expand === 'date' && (
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px', flexWrap: 'wrap' }}>
            {[['Today', 'today'], ['Tomorrow', 'tomorrow'], ['Weekend', 'weekend'], ['Next wk', 'nextweek']].map(([label, kind]) => (
              <button key={kind} onClick={() => { setAddDeadline(quickDate(kind)); setExpand(null); }} style={pchip(false, '#0ea5e9')}>{label}</button>
            ))}
            <button onClick={() => { setPickCal(true); }} style={pchip(false, '#7c3aed')}>📅 Pick…</button>
          </div>
        )}
        {expand === 'who' && (
          <div style={{ padding: '0 12px 12px' }}>
            <AssigneeChips value={addAssignee} people={roster} onAddPerson={addPerson} onSelect={id => { setAddAssignee(id); setExpand(null); }} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(13,13,13,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 14px' }}>
          {[{ id: 'mine', label: 'My Work' }, { id: 'team', label: 'Team' }].map(t => {
            const on = view === t.id;
            return (
              <button key={t.id} onClick={() => { setView(t.id); setAssigneeFilter(null); }} style={{
                padding: '7px 16px', borderRadius: 20, border: 'none', background: on ? '#7c3aed22' : 'transparent',
                color: on ? '#a78bfa' : '#555', fontSize: 13, fontWeight: on ? 700 : 400, cursor: 'pointer',
              }}>{t.label}</button>
            );
          })}
        </div>
        {view === 'team' && roster.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            <button onClick={() => setAssigneeFilter(null)} style={pchip(!assigneeFilter, '#7c3aed')}>All</button>
            <button onClick={() => setAssigneeFilter('me')} style={pchip(assigneeFilter === 'me', '#7c3aed')}>Me</button>
            {roster.map(p => (
              <button key={p.id} onClick={() => setAssigneeFilter(p.id)} style={{ ...pchip(assigneeFilter === p.id, p.color), display: 'flex', alignItems: 'center', gap: 5 }}>
                <Avatar name={p.name} color={p.color} size={16} />{p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomSheet open={pickCal} onClose={() => setPickCal(false)} title="Deadline">
        <div style={{ padding: '4px 0 12px' }}>
          <DatePicker value={addDeadline} onChange={v => setAddDeadline(v)} fullWidth />
        </div>
      </BottomSheet>

      {/* Agenda + rail (2-col on desktop, single column + fixed composer on mobile) */}
      <div className="work-agenda">
        <div className="work-main work-scroll-pad">
          {!rawItems && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0.4, 0.6, 0.5].map((o, i) => <div key={i} style={{ height: 54, background: '#161616', borderRadius: 11, opacity: o }} />)}</div>}

          {rawItems && active.length === 0 && doneList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 16, color: '#444', fontWeight: 600 }}>{view === 'mine' ? 'No priorities yet' : 'Nothing assigned'}</div>
              <div style={{ fontSize: 13, color: '#2e2e2e', marginTop: 6 }}>Add a priority to get started</div>
            </div>
          )}

          {/* P1 · Now strip */}
          {p1s.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: 1.2, textTransform: 'uppercase', padding: '2px 2px 8px' }}>🔴 Now</div>}
          {p1s.map(i => <AgendaRow key={i.id} item={i} showAssignee={showAssignee} onToggle={toggle} onOpen={setEditItem} now hideDate />)}

          {/* Time-bucketed sections */}
          {SECTIONS.map(sec => {
            const secItems = rest.filter(i => bucketOf(i) === sec.key);
            if (secItems.length === 0) return null;
            return (
              <div key={sec.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 2px 8px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: sec.color }}>{sec.label}</span>
                  <span style={{ flex: 1, height: 1, background: '#1b1b1b' }} />
                </div>
                {secItems.map(i => <AgendaRow key={i.id} item={i} showAssignee={showAssignee} onToggle={toggle} onOpen={setEditItem} hideDate={sec.key === 'today'} />)}
              </div>
            );
          })}

          {doneList.length > 0 && (
            <button onClick={() => setShowDone(s => !s)} style={{ margin: '12px 0 4px', background: 'none', border: 'none', color: '#444', fontSize: 12, cursor: 'pointer' }}>
              {showDone ? '▾' : '▸'} {doneList.length} done
            </button>
          )}
          {showDone && doneList.map(i => <AgendaRow key={i.id} item={i} showAssignee={showAssignee} onToggle={toggle} onOpen={setEditItem} />)}
        </div>

        <div className="work-rail">
          {composer}
          <div className="work-summary">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: '#4f4f4f', margin: '4px 4px 12px' }}>At a glance</div>
            {[['Overdue', overdueCount, '#ef4444'], ['Due today', todayCount, '#e8e8e8'], ['P1 now', p1s.length, '#ef4444'], ['Total open', active.length, '#e8e8e8']].map(([label, n, c]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#777', padding: '8px 4px', borderBottom: '1px solid #181818' }}>
                <span>{label}</span><b style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>{n}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WorkEditSheet item={editData} people={roster} onClose={() => setEditItem(null)} onSave={saveEdit} onDelete={del} onAddPerson={addPerson} />
    </>
  );
}

const pchip = (active, color) => ({
  flexShrink: 0, padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${active ? color + '77' : '#2a2a2a'}`, background: active ? color + '22' : 'transparent', color: active ? color : '#888',
});
const metaBtn = active => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
  border: `1px solid ${active ? '#7c3aed55' : '#262626'}`, background: active ? '#7c3aed18' : 'transparent',
  color: active ? '#a78bfa' : '#666', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
});
