'use client';
import { useState } from 'react';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const REPEAT_OPTIONS = [
  { value: null,       label: 'None' },
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekly',   label: 'Every week' },
  { value: 'monthly',  label: 'Every month' },
];

function getCalendarDays(year, month) {
  const firstDay   = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7; // shift to Monday-start
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let i = startOffset - 1; i >= 0; i--)
    days.push({ d: daysInPrevMonth - i, m: month === 0 ? 11 : month - 1, y: month === 0 ? year - 1 : year, outside: true });

  for (let i = 1; i <= daysInMonth; i++)
    days.push({ d: i, m: month, y: year, outside: false });

  while (days.length < 42)
    days.push({ d: days.length - startOffset - daysInMonth + 1, m: month === 11 ? 0 : month + 1, y: month === 11 ? year + 1 : year, outside: true });

  return days;
}

function fmt(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

export default function DatePicker({ value, recurrence, onChange, onChangeRecurrence, fullWidth = false }) {
  const now      = new Date();
  const selected = value ? new Date(value) : null;

  const [viewY, setViewY]         = useState(selected?.getFullYear() ?? now.getFullYear());
  const [viewM, setViewM]         = useState(selected?.getMonth()    ?? now.getMonth());
  const [showTime, setShowTime]   = useState(!!(selected && (selected.getHours() || selected.getMinutes())));
  const [showRepeat, setShowRepeat] = useState(false);
  const [timeVal, setTimeVal]     = useState(
    selected && (selected.getHours() || selected.getMinutes())
      ? `${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`
      : '09:00'
  );

  const days = getCalendarDays(viewY, viewM);

  function pickDay(day) {
    const d = new Date(day.y, day.m, day.d);
    if (showTime && timeVal) {
      const [h, m] = timeVal.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    onChange(d.toISOString());
    if (day.m !== viewM) { setViewY(day.y); setViewM(day.m); }
  }

  function applyTime(t) {
    setTimeVal(t);
    if (!selected) return;
    const d = new Date(selected);
    const [h, m] = t.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    onChange(d.toISOString());
  }

  function applyQuick(type) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (type === 'today')    { /* keep */ }
    else if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (type === 'weekend') {
      const dts = (6 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + dts);
    } else if (type === 'nextweek') {
      const dtm = (8 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + dtm);
    } else if (type === 'nodate') { onChange(null); return; }
    if (showTime && timeVal) {
      const [h, m] = timeVal.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    onChange(d.toISOString());
    setViewY(d.getFullYear()); setViewM(d.getMonth());
  }

  function isSelected(day) {
    return selected && selected.getDate() === day.d && selected.getMonth() === day.m && selected.getFullYear() === day.y;
  }

  function isToday(day) {
    return now.getDate() === day.d && now.getMonth() === day.m && now.getFullYear() === day.y;
  }

  const nextWeekDate = (() => {
    const d = new Date(now); const dtm = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + dtm);
    return `Mon ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  })();

  const quickOptions = [
    { type: 'today',    icon: '📅', label: 'Today',       right: now.toLocaleDateString('en',{ weekday:'short' }) },
    { type: 'tomorrow', icon: '🌤', label: 'Tomorrow',    right: new Date(now.getTime()+86400000).toLocaleDateString('en',{ weekday:'short' }) },
    { type: 'weekend',  icon: '🛋', label: 'This weekend',right: 'Sat' },
    { type: 'nextweek', icon: '↪',  label: 'Next week',   right: nextWeekDate },
    { type: 'nodate',   icon: '⊘',  label: 'No Date',     right: '' },
  ];

  const prevMonth = () => { if (viewM === 0) { setViewM(11); setViewY(y => y-1); } else setViewM(m => m-1); };
  const nextMonth = () => { if (viewM === 11) { setViewM(0); setViewY(y => y+1); } else setViewM(m => m+1); };

  return (
    <div style={{
      background: fullWidth ? 'transparent' : '#161616',
      border: fullWidth ? 'none' : '1px solid #2a2a2a',
      borderRadius: fullWidth ? 0 : 14,
      overflow: 'hidden',
      width: fullWidth ? '100%' : 280,
      boxShadow: fullWidth ? 'none' : '0 20px 60px rgba(0,0,0,0.6)',
      fontSize: 13,
      color: '#e0e0e0',
    }}>
      {/* Selected date display */}
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{
          background: '#7c3aed22',
          border: '1px solid #7c3aed44',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: selected ? '#a78bfa' : '#444',
          marginBottom: 8,
        }}>
          {selected ? fmt(selected) + (showTime ? ` at ${timeVal}` : '') : 'No date'}
        </div>
      </div>

      {/* Quick shortcuts */}
      <div style={{ padding: '4px 6px' }}>
        {quickOptions.map(opt => (
          <button
            key={opt.type}
            onClick={() => applyQuick(opt.type)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 8px', borderRadius: 8,
              background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#222'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', borderRadius: 7, fontSize: 14, flexShrink: 0 }}>{opt.icon}</span>
            <span style={{ flex: 1, color: '#ccc', fontSize: 13 }}>{opt.label}</span>
            <span style={{ color: '#555', fontSize: 12 }}>{opt.right}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: '#222', margin: '4px 0' }} />

      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px 6px', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', flex: 1 }}>
          {MONTHS[viewM]} {viewY}
        </span>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <button onClick={() => { setViewY(now.getFullYear()); setViewM(now.getMonth()); }} style={{ ...navBtn, fontSize: 10, color: '#555' }}>●</button>
        <button onClick={nextMonth} style={navBtn}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 10px', gap: 2 }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#444', padding: '2px 0', fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '2px 10px 10px', gap: 2 }}>
        {days.map((day, i) => {
          const sel   = isSelected(day);
          const today = isToday(day);
          return (
            <button
              key={i}
              onClick={() => pickDay(day)}
              style={{
                padding: '5px 0',
                borderRadius: 7,
                border: 'none',
                background: sel ? '#7c3aed' : 'transparent',
                color: sel ? '#fff' : day.outside ? '#333' : today ? '#f87171' : '#ccc',
                fontSize: 12,
                fontWeight: sel || today ? 700 : 400,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#2a2a2a'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
            >
              {day.d}
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: '#1e1e1e' }} />

      {/* Time */}
      <button
        onClick={() => setShowTime(t => !t)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 14px', background: showTime ? '#7c3aed11' : 'transparent',
          border: 'none', borderBottom: '1px solid #1e1e1e',
          color: showTime ? '#a78bfa' : '#666', fontSize: 13, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span>⏰</span> Time {showTime && <span style={{ color: '#7c3aed', fontWeight: 700 }}>{timeVal}</span>}
      </button>

      {showTime && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e1e' }}>
          <input
            type="time"
            value={timeVal}
            onChange={e => applyTime(e.target.value)}
            style={{
              width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a',
              borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 14,
              outline: 'none', colorScheme: 'dark',
            }}
          />
          {/* Quick times */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {['07:00','09:00','12:00','18:00','21:00'].map(t => (
              <button key={t} onClick={() => applyTime(t)} style={{
                padding: '4px 10px', borderRadius: 20,
                border: `1px solid ${timeVal === t ? '#7c3aed' : '#2a2a2a'}`,
                background: timeVal === t ? '#7c3aed22' : 'transparent',
                color: timeVal === t ? '#a78bfa' : '#555',
                fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Repeat */}
      <button
        onClick={() => setShowRepeat(r => !r)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 14px', background: (recurrence && recurrence !== null) ? '#7c3aed11' : 'transparent',
          border: 'none',
          color: (recurrence && recurrence !== null) ? '#a78bfa' : '#666', fontSize: 13, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span>↻</span> Repeat {recurrence && <span style={{ color: '#7c3aed', fontWeight: 700, textTransform: 'capitalize' }}>{recurrence}</span>}
      </button>

      {showRepeat && (
        <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {REPEAT_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChangeRecurrence(opt.value); setShowRepeat(false); }}
              style={{
                padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left',
                background: recurrence === opt.value ? '#7c3aed22' : 'transparent',
                color: recurrence === opt.value ? '#a78bfa' : '#aaa',
                fontSize: 13, cursor: 'pointer', fontWeight: recurrence === opt.value ? 600 : 400,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (recurrence !== opt.value) e.currentTarget.style.background = '#222'; }}
              onMouseLeave={e => { if (recurrence !== opt.value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const navBtn = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', color: '#666', fontSize: 18,
  cursor: 'pointer', borderRadius: 6, transition: 'all 0.1s',
};
