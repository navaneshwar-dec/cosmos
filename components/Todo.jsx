'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import DatePicker from './DatePicker';
import BottomSheet from './BottomSheet';

// ─── data ────────────────────────────────────────────────────────────────────

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

// ─── constants ───────────────────────────────────────────────────────────────

const LABEL_COLORS = [
  { bg: '#7c3aed22', text: '#a78bfa', border: '#7c3aed55' },
  { bg: '#0ea5e922', text: '#38bdf8', border: '#0ea5e955' },
  { bg: '#16a34a22', text: '#4ade80', border: '#16a34a55' },
  { bg: '#d9770622', text: '#fbbf24', border: '#d9770655' },
  { bg: '#dc262622', text: '#f87171', border: '#dc262655' },
  { bg: '#0d948822', text: '#2dd4bf', border: '#0d948855' },
  { bg: '#ec489922', text: '#f472b6', border: '#ec489955' },
];

const FILTERS = ['Today', 'All', 'Upcoming', 'Done'];

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS    = ['M','T','W','T','F','S','S'];

// ─── helpers ─────────────────────────────────────────────────────────────────

function labelColor(label) {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}

function formatDate(date) {
  if (!date) return null;
  const now = new Date(), d = new Date(date);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const hasTime = d.getHours() || d.getMinutes();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString())      return `Today${hasTime ? ` · ${time}` : ''}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow${hasTime ? ` · ${time}` : ''}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (hasTime ? ` · ${time}` : '');
}

function isToday(date)    { return date ? new Date(date).toDateString() === new Date().toDateString() : false; }
function isUpcoming(date) { return date ? new Date(date) > new Date() : false; }
function isOverdue(date)  { if (!date) return false; const d = new Date(date); return d < new Date() && !isToday(date); }

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.date && !b.date) return new Date(a.created_at) - new Date(b.created_at);
    if (!a.date) return 1; if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
}

function parseRecurrence(text) {
  const simple = [
    { regex: /every\s+day|daily|each\s+day|every\s+morning|every\s+night|every\s+evening/i, type: 'daily' },
    { regex: /every\s+weekday|weekdays/i,        type: 'weekdays' },
    { regex: /every\s+week(?!day)|weekly/i,       type: 'weekly'   },
    { regex: /every\s+month|monthly/i,            type: 'monthly'  },
  ];
  for (const { regex, type } of simple) { const m = text.match(regex); if (m) return { type, phrase: m[0] }; }
  const cm = text.match(/(every|each)\s+((?:(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:sday)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[\s,]*)+)/i);
  if (cm) {
    const dp = cm[2].toLowerCase(), days = [];
    if (/\bmon(day)?\b/.test(dp)) days.push('mon'); if (/\btue(s(day)?)?\b/.test(dp)) days.push('tue');
    if (/\bwed(nesday)?\b/.test(dp)) days.push('wed'); if (/\bthu(r(sday)?)?\b/.test(dp)) days.push('thu');
    if (/\bfri(day)?\b/.test(dp)) days.push('fri'); if (/\bsat(urday)?\b/.test(dp)) days.push('sat');
    if (/\bsun(day)?\b/.test(dp)) days.push('sun');
    if (days.length) return { type: days.join(','), phrase: cm[0] };
  }
  return { type: null, phrase: null };
}

function parseLabels(text) {
  const matches = [...text.matchAll(/#([a-zA-Z0-9-]+)/g)];
  const labels = [...new Set(matches.map(m => m[1].toLowerCase()))];
  const strippedText = text.replace(/#([a-zA-Z0-9-]+)/g, '').replace(/\s+/g, ' ').trim();
  return { labels, strippedText };
}

function formatRecurrence(r) {
  if (!r) return null;
  const fixed = { daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays', monthly: 'Monthly' };
  if (fixed[r]) return fixed[r];
  const dl = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  return r.split(',').map(d => dl[d] || d).join(', ');
}

// ─── useNotifications ─────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    });
  }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
}

function useNotifications(tasks) {
  const [permission, setPermission] = useState('default');
  const notified = useRef(new Set());

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    setPermission(Notification.permission);
    if (Notification.permission === 'granted') subscribeToPush().catch(() => {});
  }, []);

  async function requestPermission() {
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted') await subscribeToPush().catch(() => {});
    return p;
  }

  useEffect(() => {
    if (permission !== 'granted' || !tasks) return;
    function check() {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.date || task.completed) return;
        const dm = (new Date(task.date) - now) / 60000;
        const k15 = `${task.id}-15`, k5 = `${task.id}-5`, k0 = `${task.id}-0`;
        if (dm > 14 && dm <= 15 && !notified.current.has(k15)) { notified.current.add(k15); new Notification('⏰ Due in 15 min', { body: task.text, icon: '/icon.svg', tag: k15 }); }
        if (dm > 4  && dm <= 5  && !notified.current.has(k5))  { notified.current.add(k5);  new Notification('🔔 Due in 5 min',  { body: task.text, icon: '/icon.svg', tag: k5  }); }
        if (dm > -1 && dm <= 0  && !notified.current.has(k0))  { notified.current.add(k0);  new Notification('🔴 Due now',       { body: task.text, icon: '/icon.svg', tag: k0, requireInteraction: true }); }
      });
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [tasks, permission]);

  return { permission, requestPermission };
}

// ─── LabelInput ───────────────────────────────────────────────────────────────

function LabelInput({ labels, onChange, allLabels = [] }) {
  const [draft, setDraft] = useState('');
  function add(v) { const c = v.trim().toLowerCase().replace(/\s+/g,'-'); if (c && !labels.includes(c)) onChange([...labels,c]); setDraft(''); }
  function onKey(e) {
    if ((e.key==='Enter'||e.key===',') && draft.trim()) { e.preventDefault(); add(draft); }
    if (e.key==='Backspace' && !draft && labels.length>0) onChange(labels.slice(0,-1));
  }
  const d = draft.trim().toLowerCase();
  // Existing labels not yet on this task — typing filters them, empty shows all. Tap to reuse the exact existing label.
  const suggestions = allLabels.filter(l => !labels.includes(l) && (d === '' || l.includes(d))).slice(0, 10);
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', minHeight:48, padding:'6px 12px', background:'#111', border:'1px solid #2a2a2a', borderRadius:10 }}>
        {labels.map(l => { const c=labelColor(l); return (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:600, padding:'4px 10px', borderRadius:12, background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
            {l}
            <button onClick={() => onChange(labels.filter(x=>x!==l))} style={{ background:'none', border:'none', color:c.text, cursor:'pointer', fontSize:16, lineHeight:1, padding:0, opacity:0.6 }}>×</button>
          </span>
        ); })}
        <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={onKey} onBlur={()=>draft.trim()&&add(draft)}
          placeholder={labels.length===0?'Add labels…':''} style={{ border:'none', outline:'none', background:'transparent', color:'#e8e8e8', fontSize:14, minWidth:90, flex:1, height:32 }} />
      </div>
      {suggestions.length>0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
          {suggestions.map(l => { const c=labelColor(l); return (
            <button key={l} onClick={()=>add(l)} style={{ fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:12, background:'transparent', color:c.text, border:`1px dashed ${c.border}`, cursor:'pointer' }}>+ {l}</button>
          ); })}
        </div>
      )}
    </div>
  );
}

// ─── EditSheet ────────────────────────────────────────────────────────────────

function EditSheet({ task, open, onSave, onClose, allLabels = [] }) {
  const [text, setText]             = useState('');
  const [date, setDate]             = useState(null);
  const [recurrence, setRecurrence] = useState(null);
  const [labels, setLabels]         = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (task) { setText(task.text); setDate(task.date??null); setRecurrence(task.recurrence??null); setLabels(task.labels??[]); }
  }, [task]);

  function save() { if (!text.trim()) return; onSave(task.id, { text: text.trim(), date, recurrence, labels }); }

  const dateLabel = date ? formatDate(date) : null;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Edit task">
        {task && (
          <div style={{ padding:'12px 20px 28px', display:'flex', flexDirection:'column', gap:16 }}>
            <textarea autoFocus value={text} onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) save(); }}
              rows={2}
              style={{ width:'100%', background:'#111', border:'1px solid #2a2a2a', borderRadius:10, outline:'none', color:'#f0f0f0', fontSize:16, fontWeight:500, lineHeight:1.6, resize:'none', padding:'12px 14px', fontFamily:'inherit' }}
            />

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#444', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>Date & Time</div>
              <button onClick={()=>setShowPicker(true)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, width:'100%', textAlign:'left',
                background: date?'#7c3aed18':'#111', border:`1px solid ${date?'#7c3aed55':'#2a2a2a'}`,
                color: date?'#a78bfa':'#555', fontSize:14, fontWeight:500, cursor:'pointer',
              }}>
                <span style={{ fontSize:18 }}>🗓</span>
                <span style={{ flex:1 }}>{dateLabel??'Set date & time'}</span>
                {date && <span onClick={e=>{e.stopPropagation();setDate(null);}} style={{ opacity:0.4, fontSize:22, lineHeight:1 }}>×</span>}
              </button>
              {recurrence && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, padding:'12px 14px', borderRadius:10, background:'#7c3aed11', border:'1px solid #7c3aed33' }}>
                  <span style={{ fontSize:16, color:'#a78bfa' }}>↻</span>
                  <span style={{ flex:1, fontSize:14, color:'#a78bfa', fontWeight:500 }}>{formatRecurrence(recurrence)}</span>
                  <button onClick={()=>setRecurrence(null)} style={{ background:'none', border:'none', color:'#a78bfa', cursor:'pointer', opacity:0.4, fontSize:22, lineHeight:1, padding:0 }}>×</button>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#444', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>Labels</div>
              <LabelInput labels={labels} onChange={setLabels} allLabels={allLabels} />
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={save} disabled={!text.trim()} style={{
                flex:1, padding:'14px', background: text.trim()?'#7c3aed':'#2a2a2a', border:'none', borderRadius:12,
                color:'#fff', fontSize:15, fontWeight:700, cursor: text.trim()?'pointer':'default',
              }}>Save</button>
              <button onClick={onClose} style={{ padding:'14px 18px', background:'#111', border:'1px solid #2a2a2a', borderRadius:12, color:'#555', fontSize:15, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Date picker as a second sheet */}
      <BottomSheet open={showPicker} onClose={()=>setShowPicker(false)} title="Date & Time">
        <div style={{ padding:'4px 0 8px' }}>
          <DatePicker value={date} recurrence={recurrence} onChange={v=>setDate(v)} onChangeRecurrence={v=>setRecurrence(v)} fullWidth />
        </div>
      </BottomSheet>
    </>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function getCalDays(year, month) {
  const firstDay=new Date(year,month,1).getDay(), offset=(firstDay+6)%7;
  const inMonth=new Date(year,month+1,0).getDate(), inPrev=new Date(year,month,0).getDate();
  const days=[];
  for (let i=offset-1;i>=0;i--) days.push({d:inPrev-i,m:month===0?11:month-1,y:month===0?year-1:year,out:true});
  for (let i=1;i<=inMonth;i++) days.push({d:i,m:month,y:year,out:false});
  while (days.length<35) days.push({d:days.length-offset-inMonth+1,m:month===11?0:month+1,y:month===11?year+1:year,out:true});
  return days;
}

function CalendarView({ tasks, onEditTask, onToggleTask }) {
  const now=new Date();
  const [viewY,setViewY]=useState(now.getFullYear());
  const [viewM,setViewM]=useState(now.getMonth());
  const [selDate,setSelDate]=useState(now);

  const taskMap={};
  tasks.filter(t=>t.date).forEach(t=>{
    const d=new Date(t.date), k=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (taskMap[k]??=[]).push(t);
  });

  const calDays=getCalDays(viewY,viewM);
  const selKey=`${selDate.getFullYear()}-${selDate.getMonth()}-${selDate.getDate()}`;
  const selTasks=sortTasks(taskMap[selKey]||[]);

  const prevM=()=>{ if(viewM===0){setViewY(y=>y-1);setViewM(11);}else setViewM(m=>m-1); };
  const nextM=()=>{ if(viewM===11){setViewY(y=>y+1);setViewM(0);}else setViewM(m=>m+1); };

  return (
    <div style={{ padding:'12px 14px 32px' }}>
      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:16, gap:6 }}>
        <button onClick={prevM} style={calNavBtn}>‹</button>
        <span style={{ flex:1, textAlign:'center', fontSize:17, fontWeight:800, color:'#fff', letterSpacing:-0.3 }}>{MONTHS_LONG[viewM]} {viewY}</span>
        <button onClick={()=>{setViewY(now.getFullYear());setViewM(now.getMonth());setSelDate(now);}} style={{...calNavBtn,fontSize:11,color:'#444'}}>●</button>
        <button onClick={nextM} style={calNavBtn}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {WEEKDAYS.map((d,i)=><div key={i} style={{ textAlign:'center', fontSize:11, color:'#444', fontWeight:700, padding:'4px 0' }}>{d}</div>)}
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {calDays.map((cd,i)=>{
          const k=`${cd.y}-${cd.m}-${cd.d}`;
          const dayTasks=(taskMap[k]||[]).filter(t=>!t.completed);
          const isTodayDay=!cd.out&&cd.d===now.getDate()&&cd.m===now.getMonth()&&cd.y===now.getFullYear();
          const isSel=!cd.out&&cd.d===selDate.getDate()&&cd.m===selDate.getMonth()&&cd.y===selDate.getFullYear();
          return (
            <button key={i} onClick={()=>!cd.out&&setSelDate(new Date(cd.y,cd.m,cd.d))} style={{
              padding:'8px 2px 10px', borderRadius:10, minHeight:52,
              border:`1px solid ${isSel?'#7c3aed66':isTodayDay?'#7c3aed33':'transparent'}`,
              background: isSel?'#7c3aed22':isTodayDay?'#7c3aed0e':'transparent',
              cursor: cd.out?'default':'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:5,
            }}>
              <span style={{ fontSize:13, fontWeight:isTodayDay?800:400, color:cd.out?'#252525':isTodayDay?'#a78bfa':'#bbb', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:isTodayDay&&!isSel?'#7c3aed1a':'transparent' }}>{cd.d}</span>
              {dayTasks.length>0&&!cd.out&&(
                <div style={{ display:'flex', gap:2, justifyContent:'center' }}>
                  {dayTasks.slice(0,3).map((t,j)=><span key={j} style={{ width:5, height:5, borderRadius:'50%', background:isOverdue(t.date)?'#ef4444':isTodayDay?'#a78bfa':'#7c3aed66' }}/>)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>
            {selDate.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}
          </div>
          {selTasks.filter(t=>!t.completed).length>0&&(
            <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:'#7c3aed22', color:'#a78bfa' }}>{selTasks.filter(t=>!t.completed).length}</span>
          )}
        </div>
        {selTasks.length===0 ? (
          <div style={{ textAlign:'center', padding:'32px 20px' }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.25 }}>📭</div>
            <div style={{ fontSize:13, color:'#333' }}>No tasks for this day</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {selTasks.map(task=>(
              <div key={task.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 14px', background:'#1a1a1a', border:`1px solid ${isOverdue(task.date)?'#ef444433':'#222'}`, borderRadius:12, opacity:task.completed?0.4:1 }}>
                <button onClick={()=>onToggleTask(task.id)} style={{ width:22,height:22,borderRadius:6,flexShrink:0,border:`2px solid ${task.completed?'#7c3aed':'#333'}`,background:task.completed?'#7c3aed':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:800 }}>{task.completed&&'✓'}</button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:'#e0e0e0', textDecoration:task.completed?'line-through':'none', lineHeight:1.4 }}>{task.text}</div>
                  {task.date&&<div style={{ fontSize:12, color:isOverdue(task.date)?'#ef4444':'#555', marginTop:3 }}>{formatDate(task.date)}</div>}
                </div>
                <button onClick={()=>onEditTask(task.id)} style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:16, padding:'0 2px' }}>✎</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const calNavBtn = { width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid #2a2a2a',borderRadius:8,color:'#888',fontSize:20,cursor:'pointer' };

// ─── NotificationBell ─────────────────────────────────────────────────────────

function NotificationBell({ permission, onRequest }) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    if(!open) return;
    function h(e){if(!ref.current?.contains(e.target))setOpen(false);}
    document.addEventListener('mousedown',h);
    document.addEventListener('touchstart',h,{passive:true});
    return ()=>{document.removeEventListener('mousedown',h);document.removeEventListener('touchstart',h);};
  },[open]);

  const active=permission==='granted';
  return (
    <div style={{ position:'relative' }} ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:open?'#7c3aed22':'transparent',border:`1px solid ${open?'#7c3aed55':'#2a2a2a'}`,cursor:'pointer',fontSize:16,position:'relative',transition:'all 0.15s' }}>
        {permission==='denied'?'🔕':'🔔'}
        {active&&<span style={{ position:'absolute',top:6,right:6,width:7,height:7,borderRadius:'50%',background:'#4ade80',border:'2px solid #0d0d0d' }}/>}
      </button>
      {open&&(
        <div style={{ position:'absolute',right:0,top:'calc(100% + 8px)',zIndex:200,background:'#161616',border:'1px solid #2a2a2a',borderRadius:14,padding:18,width:240,boxShadow:'0 20px 50px rgba(0,0,0,0.7)',animation:'popIn 0.15s ease' }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#555',letterSpacing:1.5,textTransform:'uppercase',marginBottom:12 }}>Notifications</div>
          {active&&<div style={{ display:'flex',gap:10 }}><span style={{ width:8,height:8,borderRadius:'50%',background:'#4ade80',flexShrink:0,marginTop:3 }}/><div><div style={{ fontSize:13,color:'#ccc',fontWeight:600 }}>Active</div><div style={{ fontSize:11,color:'#555',marginTop:3,lineHeight:1.5 }}>5 min + 15 min before due time</div></div></div>}
          {permission==='denied'&&<div style={{ fontSize:12,color:'#ef4444',lineHeight:1.6 }}>Blocked by browser. Enable in site settings.</div>}
          {permission==='default'&&(<><div style={{ fontSize:13,color:'#888',lineHeight:1.6,marginBottom:14 }}>Get alerted before tasks are due.</div><button onClick={async()=>{await onRequest();setOpen(false);}} style={{ width:'100%',padding:'11px',background:'#7c3aed',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>Enable notifications</button></>)}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function SubtaskSection({ parentId, subtasks, onToggle, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState('');
  function commit(){ const v=draft.trim(); if(v){ onAdd(parentId, v); setDraft(''); } }
  if (subtasks.length === 0 && !adding) {
    return <div style={{ padding:'0 14px 10px 46px' }}>
      <button onClick={()=>setAdding(true)} style={{ background:'none',border:'none',color:'#444',fontSize:12.5,fontWeight:600,cursor:'pointer',padding:'2px 0' }}>+ sub-item</button>
    </div>;
  }
  return (
    <div style={{ padding:'0 14px 10px 46px', display:'flex', flexDirection:'column', gap:6 }}>
      {subtasks.map(s=>(
        <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={()=>onToggle(s.id)} style={{ width:18,height:18,borderRadius:5,flexShrink:0,border:`2px solid ${s.completed?'#7c3aed':'#333'}`,background:s.completed?'#7c3aed':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:800 }}>{s.completed&&'✓'}</button>
          <span style={{ flex:1,minWidth:0,fontSize:13.5,color:s.completed?'#444':'#c8c8c8',textDecoration:s.completed?'line-through':'none',wordBreak:'break-word' }}>{s.text}</span>
          <button onClick={()=>onDelete(s.id)} style={{ background:'none',border:'none',color:'#2e2e2e',cursor:'pointer',fontSize:16,lineHeight:1,padding:0,flexShrink:0 }}
            onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='#2e2e2e'}>×</button>
        </div>
      ))}
      {adding ? (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:18,height:18,flexShrink:0 }} />
          <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter')commit(); if(e.key==='Escape'){setAdding(false);setDraft('');} }}
            onBlur={()=>{ if(draft.trim())commit(); setAdding(false); }} placeholder="Add a sub-item…"
            style={{ flex:1, background:'#161616', border:'1px solid #262626', borderRadius:8, padding:'6px 9px', color:'#e8e8e8', fontSize:13, outline:'none' }} />
        </div>
      ) : (
        <button onClick={()=>setAdding(true)} style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#555', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:'2px 0' }}>+ sub-item</button>
      )}
    </div>
  );
}

export default function Todo() {
  const { data: rawTasks } = useSWR('/api/tasks', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const [tasks, setTasks]             = useState([]);
  const [input, setInput]             = useState('');
  const [filter, setFilter]           = useState('Today');
  const [labelFilter, setLabelFilter] = useState(null);
  const [view, setView]               = useState('list');
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [editTask, setEditTask]       = useState(null);
  const [parsedDate, setParsedDate]   = useState(null);
  const [parsedRecur, setParsedRecur] = useState(null);
  const [parsedLabels, setParsedLabels] = useState([]);
  const [chrono, setChrono]           = useState(null);
  const inputRef = useRef(null);
  const { permission, requestPermission } = useNotifications(tasks);

  useEffect(()=>{ import('chrono-node').then(setChrono); },[]);
  useEffect(()=>{ if(Array.isArray(rawTasks)) setTasks(sortTasks(rawTasks)); },[rawTasks]);

  useEffect(()=>{
    if(!input.trim()){setParsedDate(null);setParsedRecur(null);setParsedLabels([]);return;}
    setParsedRecur(parseRecurrence(input).type);
    setParsedLabels(parseLabels(input).labels);
    if(chrono){const r=chrono.parse(input);setParsedDate(r.length>0?r[0].date():null);}
  },[input,chrono]);

  async function addTask() {
    const raw=input.trim(); if(!raw) return;
    let text=raw, date=null;
    const {labels, strippedText}=parseLabels(text);
    text=strippedText;
    const {type:recurrence, phrase:recurPhrase}=parseRecurrence(text);
    if(recurPhrase) text=text.replace(recurPhrase,' ').replace(/\s+/g,' ').trim();
    if(chrono){const r=chrono.parse(text);if(r.length>0){date=r[0].date().toISOString();text=(text.slice(0,r[0].index)+text.slice(r[0].index+r[0].text.length)).replace(/\s+/g,' ').trim();}}
    text=text.replace(/\s*(,|by|at|on|in)\s*$/i,'').replace(/^(,|by|at|on|in)\s*/i,'').trim();
    if(recurrence&&!date){const d=new Date();d.setHours(0,0,0,0);date=d.toISOString();}
    const opt={id:`tmp-${Date.now()}`,text,date,recurrence,labels,completed:false,created_at:new Date().toISOString()};
    setTasks(prev=>sortTasks([...prev,opt]));
    setInput('');setParsedDate(null);setParsedRecur(null);setParsedLabels([]);
    inputRef.current?.focus();
    const res=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,date,recurrence:recurrence??null,labels})});
    const saved=await res.json();
    setTasks(prev=>sortTasks(prev.map(t=>t.id===opt.id?saved:t)));
  }

  async function toggleTask(id) {
    const task=tasks.find(t=>t.id===id); if(!task) return; const nowDone=!task.completed;
    setTasks(prev=>{
      let arr=prev.map(t=>t.id===id?{...t,completed:nowDone}:t);
      if(prev.some(t=>t.parent_id===id)) arr=arr.map(t=>t.parent_id===id?{...t,completed:nowDone}:t);            // parent → its sub-items
      if(task.parent_id){ const sibs=arr.filter(t=>t.parent_id===task.parent_id); const all=sibs.length>0&&sibs.every(s=>s.completed); arr=arr.map(t=>t.id===task.parent_id?{...t,completed:all}:t); } // sub-item → parent
      return sortTasks(arr);
    });
    const res=await fetch(`/api/tasks/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:nowDone})});
    const {task:saved,next,affected}=await res.json();
    setTasks(prev=>{
      let arr=prev.map(t=>t.id===id?saved:t);
      (affected||[]).forEach(a=>{ arr=arr.map(t=>t.id===a.id?a:t); });
      if(next) arr=[...arr,next];
      return sortTasks(arr);
    });
  }

  async function addSubtask(parentId, text){
    const v=(text||'').trim(); if(!v) return;
    const tmp={id:`tmp-${Date.now()}`,text:v,parent_id:parentId,completed:false,labels:[],date:null,created_at:new Date().toISOString()};
    setTasks(prev=>sortTasks(prev.map(t=>t.id===parentId?{...t,completed:false}:t).concat(tmp)));
    const res=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:v,parentId})});
    const saved=await res.json();
    setTasks(prev=>sortTasks(prev.map(t=>t.id===tmp.id?saved:t)));
  }

  function saveEdit(id,changes){
    setTasks(prev=>sortTasks(prev.map(t=>t.id===id?{...t,...changes}:t)));
    setEditTask(null);
    fetch(`/api/tasks/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)})
      .then(r=>r.json()).then(({task})=>setTasks(prev=>sortTasks(prev.map(t=>t.id===id?task:t))));
  }

  async function deleteTask(id){
    setTasks(prev=>prev.filter(t=>t.id!==id));
    await fetch(`/api/tasks/${id}`,{method:'DELETE'});
  }

  async function clearDone(){
    const done=tasks.filter(t=>t.completed);
    setTasks(prev=>prev.filter(t=>!t.completed));
    await Promise.all(done.map(t=>fetch(`/api/tasks/${t.id}`,{method:'DELETE'})));
  }

  const allLabels  = [...new Set(tasks.flatMap(t=>t.labels||[]))].sort();
  const overdueCount = tasks.filter(t=>!t.completed&&isOverdue(t.date)).length;
  const todayCount = tasks.filter(t=>!t.completed&&isToday(t.date)).length + overdueCount;

  const searchActive = searchQuery.trim().length>0;
  const filtered = tasks.filter(t=>{
    if(t.parent_id) return false;   // sub-items render nested under their parent
    if(recurringOnly&&!t.recurrence) return false;
    if(searchActive){
      const q=searchQuery.trim().toLowerCase();
      return t.text.toLowerCase().includes(q)||(t.labels||[]).some(l=>l.toLowerCase().includes(q));
    }
    const mf = filter==='All'?!t.completed:filter==='Today'?!t.completed&&(isToday(t.date)||isOverdue(t.date)):filter==='Upcoming'?!t.completed&&isUpcoming(t.date):t.completed;
    const lf = !labelFilter || (labelFilter==='__none__' ? (t.labels||[]).length===0 : (t.labels||[]).includes(labelFilter));
    return mf&&lf;
  });

  const hasPreview = parsedDate||parsedRecur||parsedLabels.length>0;

  return (
    <>
      {/* ── Sticky toolbar ─────────────────────────────────────────────────── */}
      <div style={{ position:'sticky',top:0,zIndex:20,background:'rgba(13,13,13,0.96)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',borderBottom:'1px solid #1a1a1a' }}>
        {/* Filter + actions row */}
        <div style={{ display:'flex', alignItems:'center', padding:'10px 14px 0', gap:6 }}>
          <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', flex:1, WebkitOverflowScrolling:'touch', msOverflowStyle:'none' }}>
            {FILTERS.map(f=>{
              const active=view==='list'&&filter===f;
              return (
                <button key={f} onClick={()=>{setFilter(f);setView('list');}} style={{ flexShrink:0, padding:'7px 14px', borderRadius:20, border:'none', background:active?'#7c3aed22':'transparent', color:active?'#a78bfa':'#555', fontSize:13, fontWeight:active?700:400, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s' }}>
                  {f}{f==='Today'&&todayCount>0&&<span style={{ marginLeft:5, background:'#7c3aed', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>{todayCount}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={()=>{setSearchOpen(o=>{const next=!o;if(!next)setSearchQuery('');return next;});}} style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:searchOpen?'#7c3aed22':'transparent',border:`1px solid ${searchOpen?'#7c3aed55':'#2a2a2a'}`,color:searchOpen?'#a78bfa':'#444',cursor:'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button onClick={()=>setView(v=>v==='calendar'?'list':'calendar')} style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:view==='calendar'?'#7c3aed22':'transparent',border:`1px solid ${view==='calendar'?'#7c3aed55':'#2a2a2a'}`,color:view==='calendar'?'#a78bfa':'#444',cursor:'pointer',fontSize:15 }}>📅</button>
            <NotificationBell permission={permission} onRequest={requestPermission}/>
          </div>
        </div>

        {/* Search row */}
        {searchOpen&&(
          <div style={{ padding:'8px 14px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'0 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search tasks…" autoFocus
                style={{ flex:1,background:'transparent',border:'none',outline:'none',color:'#e8e8e8',fontSize:14,padding:'10px 0' }} />
              {searchQuery&&<button onClick={()=>setSearchQuery('')} style={{ background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:16,flexShrink:0 }}>×</button>}
            </div>
          </div>
        )}

        {/* Label chips */}
        {!searchActive&&(allLabels.length>0||tasks.some(t=>t.recurrence))&&(
          <div style={{ display:'flex', gap:6, padding:'8px 14px', overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', msOverflowStyle:'none' }}>
            {tasks.some(t=>t.recurrence)&&(
              <button onClick={()=>setRecurringOnly(v=>!v)} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${recurringOnly?'#7c3aed55':'#2a2a2a'}`, background:recurringOnly?'#7c3aed22':'transparent', color:recurringOnly?'#a78bfa':'#555', cursor:'pointer' }}>↻ Recurring</button>
            )}
            {labelFilter&&<button onClick={()=>setLabelFilter(null)} style={{ flexShrink:0, fontSize:12, padding:'3px 10px', borderRadius:12, border:'1px solid #2a2a2a', background:'transparent', color:'#555', cursor:'pointer' }}>× All</button>}
            {allLabels.length>0&&(()=>{const active=labelFilter==='__none__';return(
              <button onClick={()=>setLabelFilter(active?null:'__none__')} style={{ flexShrink:0, fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${active?'#7c3aed55':'#2a2a2a'}`, background:active?'#7c3aed22':'transparent', color:active?'#a78bfa':'#555', cursor:'pointer' }}>⊘ No label</button>
            );})()}
            {allLabels.map(l=>{const c=labelColor(l),active=labelFilter===l;return(
              <button key={l} onClick={()=>setLabelFilter(active?null:l)} style={{ flexShrink:0, fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${active?c.border:'#2a2a2a'}`, background:active?c.bg:'transparent', color:active?c.text:'#555', cursor:'pointer' }}>{l}</button>
            );})}
          </div>
        )}

        {tasks.some(t=>t.completed)&&(
          <div style={{ padding:'2px 14px 8px', textAlign:'right' }}>
            <button onClick={clearDone} style={{ fontSize:12,color:'#444',background:'none',border:'none',cursor:'pointer' }}>Clear done ×</button>
          </div>
        )}
      </div>

      {/* ── Input bar (CSS makes it fixed-bottom on mobile) ── */}
      <div className="todo-input-bar">
        <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex', alignItems:'center', padding:'2px 4px 2px 14px', gap:8 }}>
            <span style={{ color:'#333', fontSize:18, flexShrink:0 }}>+</span>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}
              placeholder="Add a task… try 'standup every day at 9am #work'"
              style={{ flex:1,background:'transparent',border:'none',outline:'none',color:'#e8e8e8',fontSize:15,padding:'14px 0' }} autoFocus
            />
            {input.trim()&&<button onClick={addTask} style={{ padding:'8px 16px',background:'#7c3aed',border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0 }}>Add</button>}
          </div>
          {hasPreview&&(
            <div style={{ padding:'0 14px 10px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {parsedDate&&<span style={{ fontSize:12,color:'#a78bfa' }}>🗓 {formatDate(parsedDate)}</span>}
              {parsedRecur&&<span style={{ fontSize:11,fontWeight:700,background:'#7c3aed22',color:'#a78bfa',padding:'2px 8px',borderRadius:10 }}>↻ {formatRecurrence(parsedRecur)}</span>}
              {parsedLabels.map(l=>{const c=labelColor(l);return <span key={l} style={{ fontSize:11,fontWeight:600,background:c.bg,color:c.text,border:`1px solid ${c.border}`,padding:'2px 8px',borderRadius:10 }}>{l}</span>;})}
            </div>
          )}
        </div>
      </div>

      {/* ── Calendar view ── */}
      {view==='calendar'&&(
        <CalendarView tasks={tasks} onEditTask={id=>{const t=tasks.find(x=>x.id===id);if(t){setEditTask(t);setView('list');}}} onToggleTask={toggleTask}/>
      )}

      {/* ── List view ── */}
      {view==='list'&&(
        <div className="todo-scroll-pad" style={{ padding:'12px 14px 0' }}>
          {/* Skeleton */}
          {!rawTasks&&<div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {[0.4,0.6,0.5].map((o,i)=><div key={i} style={{ height:62,background:'#1a1a1a',borderRadius:12,opacity:o }}/>)}
          </div>}

          {/* Empty state */}
          {rawTasks&&filtered.length===0&&(
            <div style={{ textAlign:'center',padding:'60px 20px' }}>
              <div style={{ fontSize:44,marginBottom:12 }}>{searchActive?'🔍':recurringOnly?'↻':filter==='Done'?'🎉':'✅'}</div>
              <div style={{ fontSize:16,color:'#444',fontWeight:600 }}>{searchActive?'No matches':recurringOnly?'No recurring tasks':filter==='Done'?'Nothing completed yet':filter==='Today'?'No tasks today':'All clear'}</div>
              <div style={{ fontSize:13,color:'#2e2e2e',marginTop:6 }}>{searchActive?`Nothing found for "${searchQuery.trim()}"`:recurringOnly?'Set a repeat on a task to see it here':filter==='Today'?'Type above to add a task':labelFilter?`No tasks with label "${labelFilter}"`:'Add something above'}</div>
            </div>
          )}

          {/* Task rows */}
          {!searchActive&&filter==='Today'&&filtered.some(t=>isOverdue(t.date))&&(
            <div style={{ fontSize:11,fontWeight:700,color:'#ef4444',letterSpacing:1.2,textTransform:'uppercase',padding:'4px 2px 8px',opacity:0.7 }}>Overdue</div>
          )}
          {filtered.map((task,idx)=>{
            const prevOverdue = idx>0&&isOverdue(filtered[idx-1].date);
            const thisToday   = isToday(task.date);
            const showTodayDivider = !searchActive&&filter==='Today'&&thisToday&&prevOverdue;
            const kids = tasks.filter(t=>t.parent_id===task.id);
            const kidsDone = kids.filter(k=>k.completed).length;
            return <>
              {showTodayDivider&&<div key={`div-${task.id}`} style={{ fontSize:11,fontWeight:700,color:'#a78bfa',letterSpacing:1.2,textTransform:'uppercase',padding:'12px 2px 8px',opacity:0.7 }}>Today</div>}
              <div key={task.id} style={{ marginBottom:6,background:'#1a1a1a',border:`1px solid ${isOverdue(task.date)?'#ef444433':task.recurrence?'#7c3aed14':'#1e1e1e'}`,borderRadius:12,opacity:task.completed?0.45:1,transition:'opacity 0.2s' }}>
              <div style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'13px 14px' }}>
              {/* Checkbox */}
              <button onClick={()=>toggleTask(task.id)} style={{ width:24,height:24,borderRadius:7,border:`2px solid ${task.completed?'#7c3aed':'#2e2e2e'}`,background:task.completed?'#7c3aed':'transparent',cursor:'pointer',flexShrink:0,marginTop:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:800,transition:'all 0.15s' }}>
                {task.completed&&'✓'}
              </button>

              {/* Content — tap opens edit */}
              <button onClick={()=>setEditTask(task)} style={{ flex:1,minWidth:0,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ flex:1,minWidth:0,fontSize:15,color:task.completed?'#444':'#e0e0e0',textDecoration:task.completed?'line-through':'none',lineHeight:1.45,wordBreak:'break-word' }}>{task.text}</span>
                  {kids.length>0&&<span style={{ flexShrink:0,fontSize:11,fontWeight:700,color:kidsDone===kids.length?'#4ade80':'#a78bfa',background:'#7c3aed14',padding:'1px 8px',borderRadius:8,fontVariantNumeric:'tabular-nums' }}>{kidsDone}/{kids.length}</span>}
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:5,flexWrap:'wrap' }}>
                  {task.date&&<span style={{ fontSize:12,color:isOverdue(task.date)?'#ef4444':isToday(task.date)?'#a78bfa':'#555' }}>{isOverdue(task.date)?'⚠ ':''}{formatDate(task.date)}</span>}
                  {task.recurrence&&<span style={{ fontSize:11,fontWeight:600,background:'#7c3aed14',color:'#6d4fc7',padding:'1px 7px',borderRadius:8 }}>↻ {formatRecurrence(task.recurrence)}</span>}
                  {(task.labels||[]).map(l=>{const c=labelColor(l);return <span key={l} onClick={e=>{e.stopPropagation();setLabelFilter(labelFilter===l?null:l);}} style={{ fontSize:11,fontWeight:600,padding:'1px 7px',borderRadius:8,background:c.bg,color:c.text,border:`1px solid ${c.border}`,cursor:'pointer' }}>{l}</span>;})}
                </div>
              </button>

              {/* Delete */}
              <button onClick={()=>deleteTask(task.id)} style={{ background:'none',border:'none',color:'#2e2e2e',cursor:'pointer',fontSize:22,lineHeight:1,padding:'0 0 0 4px',flexShrink:0,transition:'color 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='#2e2e2e'}>×</button>
              </div>
              <SubtaskSection parentId={task.id} subtasks={kids} onToggle={toggleTask} onAdd={addSubtask} onDelete={deleteTask} />
            </div>
            </>;

          })}

          {rawTasks&&tasks.length>0&&(
            <div style={{ textAlign:'center',fontSize:12,color:'#2a2a2a',padding:'8px 0 4px' }}>
              {tasks.filter(t=>!t.completed).length} remaining · {tasks.filter(t=>t.completed).length} done
            </div>
          )}
        </div>
      )}

      {/* ── Edit bottom sheet ── */}
      <EditSheet task={editTask} open={!!editTask} onSave={saveEdit} onClose={()=>setEditTask(null)} allLabels={allLabels}/>
    </>
  );
}
