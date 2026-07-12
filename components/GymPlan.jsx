'use client';
import { useState, useEffect, useRef } from 'react';
import BottomSheet from './BottomSheet';

// ─── exercise data ────────────────────────────────────────────────────────────

const days = [
  { day: "MON", label: "Rest Day", theme: "rest", icon: "🛌", focus: "Recovery", tip: "Hydrate well, stretch lightly, sleep 7–9 hrs.", exercises: [] },
  { day: "TUE", label: "Chest & Triceps", theme: "push", icon: "💪", focus: "Push (Upper)", tip: "Keep your shoulder blades squeezed back on pressing moves.", exercises: [
    { name: "Flat Chest Press", desc: "Lie on bench. Push barbell or dumbbells straight up from chest. Lower slowly.", sets: "4", reps: "10–12", muscle: "Chest", feel: "Chest squeeze at top", yt: "https://www.youtube.com/watch?v=vcBig73ojpE", short: "https://www.youtube.com/shorts/SidmT09GXz8", shortNote: "Dumbbell version, under 60s" },
    { name: "Incline Press", desc: "Same as flat but bench angled ~30–45°. Targets upper chest.", sets: "3", reps: "10–12", muscle: "Upper Chest", feel: "Upper chest burn", yt: "https://www.youtube.com/watch?v=vcBig73ojpE", short: "https://www.youtube.com/shorts/ljyqdC4ydrM", shortNote: "Dumbbell version, under 60s" },
    { name: "Cable Chest Fly", desc: "Stand between cables, arms wide, bring hands together in front of chest.", sets: "3", reps: "12–15", muscle: "Chest", feel: "Stretch across chest", yt: "https://www.youtube.com/watch?v=vcBig73ojpE", short: "https://www.youtube.com/shorts/Cxbh9ofyR0s", shortNote: "Pec deck version — same squeeze" },
    { name: "Overhead Tricep Extension", desc: "Hold one dumbbell overhead with both hands, lower behind head, press up.", sets: "3", reps: "12", muscle: "Triceps", feel: "Back of arm burn", yt: "https://www.youtube.com/watch?v=popGXI-qs98", short: "https://www.youtube.com/shorts/uID8NFK1p5Y", shortNote: "Cross-cable variation" },
    { name: "Tricep Pushdown", desc: "Stand at cable machine. Push rope/bar downward until arms fully straight.", sets: "3", reps: "12–15", muscle: "Triceps", feel: "Back of arm squeeze", yt: "https://www.youtube.com/watch?v=popGXI-qs98", short: null },
  ]},
  { day: "WED", label: "Back & Biceps", theme: "pull", icon: "🏋️", focus: "Pull (Upper)", tip: "Think about pulling with your elbows, not your hands.", exercises: [
    { name: "Lat Pulldown", desc: "Sit at cable machine, pull bar down to upper chest. Wide grip.", sets: "4", reps: "10–12", muscle: "Back (lats)", feel: "Wings widening", yt: "https://www.youtube.com/watch?v=O94yEoGXtBY", short: null },
    { name: "Seated Cable Row", desc: "Sit at cable row machine, pull handle to belly button. Keep chest up.", sets: "4", reps: "10–12", muscle: "Mid Back", feel: "Shoulder blades squeezing", yt: "https://www.youtube.com/watch?v=djKXLt7kv7Q", short: null },
    { name: "Dumbbell Row", desc: "One knee on bench, row dumbbell up to hip. Like starting a lawnmower.", sets: "3", reps: "10 each side", muscle: "Back", feel: "Back squeeze at top", yt: "https://www.youtube.com/watch?v=djKXLt7kv7Q", short: null },
    { name: "Barbell or Dumbbell Curl", desc: "Stand holding weights, curl up to shoulder keeping elbows still.", sets: "3", reps: "10–12", muscle: "Biceps", feel: "Front of arm pump", yt: "https://www.youtube.com/watch?v=i1YgFZB6alI", short: null },
    { name: "Hammer Curl", desc: "Same as curl but palms face each other (like holding hammers).", sets: "3", reps: "12", muscle: "Biceps & Forearms", feel: "Outer arm burn", yt: "https://www.youtube.com/watch?v=i1YgFZB6alI", short: null },
  ]},
  { day: "THU", label: "Legs & Glutes", theme: "legs", icon: "🦵", focus: "Lower Body", tip: "Push through your heels and keep your chest up on all squat/press moves.", exercises: [
    { name: "Leg Press Machine", desc: "Sit in machine, place feet shoulder-width on platform. Push away slowly.", sets: "4", reps: "12–15", muscle: "Quads & Glutes", feel: "Thigh burn", yt: "https://www.youtube.com/watch?v=H6mRkx1x77k", short: null },
    { name: "Squat (Barbell or Goblet)", desc: "Feet shoulder-width, lower as if sitting on a chair, drive back up.", sets: "4", reps: "10–12", muscle: "Full Leg", feel: "Full leg engagement", yt: "https://www.youtube.com/watch?v=bEv6CCg2BC8", short: null },
    { name: "Romanian Deadlift", desc: "Hold bar/dumbbells, hinge forward at hips keeping back flat, feel hamstrings stretch.", sets: "3", reps: "10–12", muscle: "Hamstrings & Glutes", feel: "Hamstring pull", yt: "https://www.youtube.com/watch?v=P9IOX-xsrDs", short: null },
    { name: "Walking Lunges", desc: "Step forward into lunge, back knee near floor, step through alternating legs.", sets: "3", reps: "12 each leg", muscle: "Quads & Glutes", feel: "Front thigh burn", yt: "https://www.youtube.com/watch?v=H6mRkx1x77k", short: null },
    { name: "Calf Raise Machine", desc: "Stand on raised platform, raise up on toes, lower slowly below platform.", sets: "4", reps: "15–20", muscle: "Calves", feel: "Back of lower leg burn", yt: "https://www.youtube.com/watch?v=H6mRkx1x77k", short: null },
  ]},
  { day: "FRI", label: "Shoulders & Core", theme: "shoulders", icon: "🎯", focus: "Shoulders + Core", tip: "Don't shrug your neck on shoulder presses — keep shoulders down.", exercises: [
    { name: "Seated Shoulder Press", desc: "Sit with dumbbells at ear level, press straight overhead. Lower slow.", sets: "4", reps: "10–12", muscle: "Shoulders", feel: "Top of shoulder burn", yt: "https://www.youtube.com/watch?v=_RlRDWO2jfg", short: null },
    { name: "Lateral Raise", desc: "Stand holding dumbbells at sides, raise arms out to shoulder height like wings.", sets: "3", reps: "12–15", muscle: "Side Shoulders", feel: "Side shoulder ache", yt: "https://www.youtube.com/watch?v=SgyUoY0IZ7A", short: null },
    { name: "Front Raise", desc: "Hold dumbbells at thighs, raise one or both arms straight in front to shoulder height.", sets: "3", reps: "12", muscle: "Front Shoulders", feel: "Front shoulder burn", yt: "https://www.youtube.com/watch?v=SgyUoY0IZ7A", short: null },
    { name: "Plank", desc: "Hold push-up position on forearms or hands. Body flat like a board.", sets: "3", reps: "30–45 sec", muscle: "Core", feel: "Stomach tightening", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
    { name: "Cable Crunch", desc: "Kneel at cable machine, pull rope to ears, crunch down toward knees.", sets: "3", reps: "15", muscle: "Abs", feel: "Upper ab squeeze", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
  ]},
  { day: "SAT", label: "Full Body + Cardio", theme: "fullbody", icon: "🔥", focus: "Fat Burn Circuit", tip: "Keep rest short (30–45 sec) between exercises to keep heart rate up.", exercises: [
    { name: "Kettlebell / Dumbbell Swing", desc: "Hinge at hips, swing weight between legs then drive hips forward to swing it up.", sets: "4", reps: "15", muscle: "Full Body", feel: "Hip pop + breathless", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
    { name: "Goblet Squat", desc: "Hold one heavy dumbbell at chest, squat deep, elbows inside knees.", sets: "3", reps: "15", muscle: "Legs & Core", feel: "Full leg fatigue", yt: "https://www.youtube.com/watch?v=bEv6CCg2BC8", short: null },
    { name: "Battle Ropes", desc: "Hold rope ends, make waves alternating arms as fast as possible.", sets: "4", reps: "30 sec on / 15 sec off", muscle: "Full Body Cardio", feel: "Arms burning fast", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
    { name: "Box Step-Ups", desc: "Step one foot onto a box/bench, drive up through heel, step back down.", sets: "3", reps: "12 each leg", muscle: "Glutes & Quads", feel: "Glute squeeze at top", yt: "https://www.youtube.com/watch?v=H6mRkx1x77k", short: null },
    { name: "Treadmill Intervals", desc: "2 min easy walk → 1 min fast jog. Repeat 6–8 times.", sets: "1", reps: "20–25 min", muscle: "Cardio", feel: "Heart rate up", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
  ]},
  { day: "SUN", label: "Active Recovery", theme: "recovery", icon: "🧘", focus: "Mobility & Rest", tip: "This is not a skip day — movement here speeds up results.", exercises: [
    { name: "Foam Roll (Full Body)", desc: "Slowly roll over each muscle group — quads, back, calves — pausing on tight spots.", sets: "1", reps: "5–10 min", muscle: "Recovery", feel: "Release of tightness", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
    { name: "Hip Flexor Stretch", desc: "Kneel one knee down, push hips forward gently. Hold each side.", sets: "2", reps: "45 sec each", muscle: "Hips", feel: "Front of hip opening", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
    { name: "Light Treadmill Walk", desc: "Casual 20–30 min walk. Not a workout — just keep moving.", sets: "1", reps: "20–30 min", muscle: "Cardio (gentle)", feel: "Light and easy", yt: "https://www.youtube.com/watch?v=Y4Vv2ASsyhs", short: null },
  ]},
];

const themes = {
  rest:      { bg: "#0f0f1a", accent: "#6366f1", dim: "#6366f122", badge: "#6366f1" },
  push:      { bg: "#150a2e", accent: "#7c3aed", dim: "#7c3aed22", badge: "#7c3aed" },
  pull:      { bg: "#061525", accent: "#0ea5e9", dim: "#0ea5e922", badge: "#0ea5e9" },
  legs:      { bg: "#071a07", accent: "#16a34a", dim: "#16a34a22", badge: "#16a34a" },
  shoulders: { bg: "#1a0e00", accent: "#f59e0b", dim: "#f59e0b22", badge: "#f59e0b" },
  fullbody:  { bg: "#1a0505", accent: "#ef4444", dim: "#ef444422", badge: "#ef4444" },
  recovery:  { bg: "#051a1a", accent: "#14b8a6", dim: "#14b8a622", badge: "#14b8a6" },
};

// ─── helper: parse rep range ──────────────────────────────────────────────────

function defaultReps(repsStr) {
  if (!repsStr) return 10;
  const m = repsStr.match(/(\d+)/g);
  if (!m) return 10;
  return parseInt(m[m.length - 1]);
}

// ─── LogSheet ─────────────────────────────────────────────────────────────────

function LogSheet({ open, onClose, ex, day, existingLog, t, onSaved }) {
  const planned   = parseInt(ex?.sets) || 3;
  const defReps   = defaultReps(ex?.reps);
  const startedAt = useRef(null);

  const [sets, setSets]           = useState([]);
  const [skipped, setSkipped]     = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [notes, setNotes]         = useState('');
  const [unit, setUnit]           = useState('kg');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!open || !ex) return;
    setError(null);
    if (!startedAt.current) startedAt.current = new Date().toISOString();

    if (existingLog && existingLog.sets?.length > 0) {
      setSets(existingLog.sets);
      setSkipped(existingLog.skipped ?? false);
      setSkipReason(existingLog.skip_reason ?? '');
      setNotes(existingLog.notes ?? '');
      if (existingLog.sets[0]?.unit) setUnit(existingLog.sets[0].unit);
    } else {
      const lastW = localStorage.getItem(`gym-weight-${ex.name}`) ?? '';
      setSets(Array.from({ length: planned }, () => ({ reps: defReps, weight: lastW, completed: true, unit: 'kg' })));
      setSkipped(existingLog?.skipped ?? false);
      setSkipReason(existingLog?.skip_reason ?? '');
      setNotes(existingLog?.notes ?? '');
    }
  }, [open, ex]);

  useEffect(() => { if (!open) startedAt.current = null; }, [open]);

  function updateSet(i, field, val) {
    setSets(prev => prev.map((s, j) => j === i ? { ...s, [field]: val, unit } : s));
  }

  function adjustWeight(i, delta) {
    setSets(prev => prev.map((s, j) => {
      if (j !== i) return s;
      const next = Math.max(0, (parseFloat(s.weight) || 0) + delta);
      return { ...s, weight: Number.isInteger(next) ? String(next) : next.toFixed(1), unit };
    }));
  }

  function applyWeightAll(w) {
    setSets(prev => prev.map(s => ({ ...s, weight: w, unit })));
  }

  function addSet() {
    const last = sets[sets.length - 1];
    setSets(prev => [...prev, { reps: last?.reps ?? defReps, weight: last?.weight ?? '', completed: true, unit }]);
  }

  function removeSet(i) {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, j) => j !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const topWeight = sets.filter(s => s.weight).sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight))[0]?.weight;

    const payload = {
      log_date:    new Date().toISOString().split('T')[0],
      day,
      exercise:    ex.name,
      started_at:  startedAt.current || new Date().toISOString(),
      ended_at:    new Date().toISOString(),
      sets:        skipped ? [] : sets.map(s => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0, unit, completed: s.completed })),
      skipped,
      skip_reason: skipped ? (skipReason || null) : null,
      notes:       notes.trim() || null,
    };

    try {
      const res = await fetch('/api/workout-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const saved = await res.json();
      if (topWeight) localStorage.setItem(`gym-weight-${ex.name}`, topWeight);
      setSaving(false);
      onSaved(saved);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Could not save — check your connection and try again');
    }
  }

  const doneSets  = sets.filter(s => s.completed).length;
  const hasWeight = sets.some(s => s.weight);

  return (
    <BottomSheet open={open} onClose={onClose} title={ex?.name ?? ''}>
      {ex && (
        <div style={{ padding: '12px 20px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Planned chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[{ icon: '📋', label: `${ex.sets} sets planned` }, { icon: '🔁', label: ex.reps + ' reps' }, { icon: '💪', label: ex.muscle }].map(c => (
              <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>
                {c.icon} {c.label}
              </span>
            ))}
          </div>

          {/* Skip toggle */}
          <button onClick={() => setSkipped(s => !s)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 12,
            background: skipped ? '#ef444418' : '#1a1a1a',
            border: `1px solid ${skipped ? '#ef444466' : '#2a2a2a'}`,
            color: skipped ? '#ef4444' : '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 18 }}>{skipped ? '✓' : '○'}</span>
            {skipped ? 'Marked as skipped — tap to undo' : 'Skip this exercise'}
          </button>

          {skipped ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Reason (optional)</div>
              <input value={skipReason} onChange={e => setSkipReason(e.target.value)}
                placeholder="e.g. Equipment taken, injury, time…"
                style={{ width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', color: '#e0e0e0', fontSize: 14, outline: 'none' }}
              />
            </div>
          ) : (
            <>
              {/* Unit + apply all weight */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0' }}>
                  {sets.length} sets
                  {hasWeight && <span style={{ marginLeft: 8, fontSize: 12, color: '#555', fontWeight: 400 }}>
                    tap weight to apply to all ↓
                  </span>}
                </div>
                <div style={{ display: 'flex', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
                  {['kg','lbs'].map(u => (
                    <button key={u} onClick={() => { setUnit(u); setSets(prev => prev.map(s => ({ ...s, unit: u }))); }} style={{
                      padding: '6px 14px', background: unit === u ? '#7c3aed' : 'transparent', border: 'none',
                      color: unit === u ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{u}</button>
                  ))}
                </div>
              </div>

              {/* Set cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sets.map((s, i) => (
                  <div key={i} style={{
                    background: s.completed ? '#1a1a1a' : '#1a0a0a',
                    border: `1px solid ${s.completed ? '#2a2a2a' : '#ef444433'}`,
                    borderRadius: 14, padding: '14px', transition: 'all 0.15s',
                  }}>
                    {/* Set header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Set {i + 1}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => updateSet(i, 'completed', !s.completed)} style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: s.completed ? '#16a34a22' : '#ef444422',
                          color: s.completed ? '#4ade80' : '#ef4444',
                        }}>
                          {s.completed ? '✓ Done' : '✗ Failed'}
                        </button>
                        {sets.length > 1 && (
                          <button onClick={() => removeSet(i)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
                        )}
                      </div>
                    </div>

                    {/* Reps + Weight */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                      {/* Reps */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Reps</div>
                        <div style={{ display: 'flex', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#111' }}>
                          <button onClick={() => updateSet(i, 'reps', Math.max(0, (parseInt(s.reps) || 0) - 1))} style={adjBtn}>−</button>
                          <input type="number" inputMode="numeric" value={s.reps} onChange={e => updateSet(i, 'reps', e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', width: 0 }} />
                          <button onClick={() => updateSet(i, 'reps', (parseInt(s.reps) || 0) + 1)} style={adjBtn}>+</button>
                        </div>
                      </div>

                      {/* Weight */}
                      <div style={{ flex: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Weight ({unit})</div>
                        <div style={{ display: 'flex', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#111', alignItems: 'stretch' }}>
                          <button onClick={() => adjustWeight(i, -2.5)} style={{ ...adjBtn, padding: '0 12px', fontSize: 12, fontWeight: 700 }}>−2.5</button>
                          <input
                            type="number" inputMode="decimal" value={s.weight}
                            onChange={e => updateSet(i, 'weight', e.target.value)}
                            onBlur={() => { if (i === 0 && s.weight) applyWeightAll(s.weight); }}
                            placeholder="0"
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', width: 0 }}
                          />
                          <button onClick={() => adjustWeight(i, 2.5)} style={{ ...adjBtn, padding: '0 12px', fontSize: 12, fontWeight: 700 }}>+2.5</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add set */}
                <button onClick={addSet} style={{
                  padding: '11px', background: 'transparent', border: '1px dashed #2a2a2a',
                  borderRadius: 12, color: '#444', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  + Add set
                </button>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Form tips, how it felt, next goal…"
              rows={2}
              style={{ width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', color: '#e0e0e0', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#ef444414', border: '1px solid #ef444444', borderRadius: 10, color: '#ef4444', fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* Save */}
          <button onClick={save} disabled={saving} style={{
            padding: '15px', background: skipped ? '#ef444433' : t?.accent ?? '#7c3aed',
            border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.6 : 1, transition: 'all 0.15s',
          }}>
            {saving ? 'Saving…' : skipped ? '⊘ Save as Skipped' : `✓ Save — ${doneSets}/${sets.length} sets done`}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

const adjBtn = { background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '0 14px', fontSize: 20, lineHeight: 1, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' };

// ─── LogSummary chip ──────────────────────────────────────────────────────────

function LogSummary({ log, accent }) {
  if (!log) return null;

  if (log.skipped) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#ef444415', color: '#ef4444', border: '1px solid #ef444433' }}>
        ⊘ Skipped{log.skip_reason ? ` · ${log.skip_reason}` : ''}
      </div>
    );
  }

  const sets     = log.sets ?? [];
  const done     = sets.filter(s => s.completed).length;
  const weights  = [...new Set(sets.filter(s => s.weight > 0).map(s => s.weight))];
  const unit     = sets[0]?.unit ?? 'kg';
  const timeStr  = log.started_at ? new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>
        ✓ {done}/{sets.length} sets
      </span>
      {weights.length > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>
          🏋 {weights.join(' / ')} {unit}
        </span>
      )}
      {timeStr && (
        <span style={{ fontSize: 11, color: '#444' }}>⏱ {timeStr}</span>
      )}
    </div>
  );
}

// ─── LinkEditorSheet ──────────────────────────────────────────────────────────

function LinkEditorSheet({ day, exercise, current, open, onSaved, onClose }) {
  const [yt, setYt]               = useState(current.yt || '');
  const [short, setShort]         = useState(current.short || '');
  const [shortNote, setShortNote] = useState(current.shortNote || '');
  const [saving, setSaving]       = useState(false);
  const [flash, setFlash]         = useState(false);

  useEffect(() => {
    if (open) { setYt(current.yt||''); setShort(current.short||''); setShortNote(current.shortNote||''); }
  }, [open]);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/gym-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, exercise: exercise.name, yt: yt||null, short: short||null, short_note: shortNote||null }),
    });
    const row = await res.json();
    setSaving(false);
    setFlash(true);
    onSaved({ yt: row.yt, short: row.short, shortNote: row.short_note });
    setTimeout(() => { setFlash(false); onClose(); }, 700);
  }

  const inp = { width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', color: '#e0e0e0', fontSize: 14, outline: 'none', fontFamily: 'monospace' };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Edit links · ${exercise?.name ?? ''}`}>
      <div style={{ padding: '8px 20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            <span style={{ color: '#ef4444' }}>▶</span> Full Tutorial URL
          </div>
          <input value={yt} onChange={e => setYt(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={inp}
            onFocus={e => e.target.style.borderColor='#7c3aed'} onBlur={e => e.target.style.borderColor='#2a2a2a'} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            <span style={{ color: '#aaa' }}>⚡</span> Short / Reel URL
          </div>
          <input value={short} onChange={e => setShort(e.target.value)} placeholder="https://youtube.com/shorts/..." style={inp}
            onFocus={e => e.target.style.borderColor='#7c3aed'} onBlur={e => e.target.style.borderColor='#2a2a2a'} />
        </div>
        {short && (
          <div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>Short description</div>
            <input value={shortNote} onChange={e => setShortNote(e.target.value)} placeholder="e.g. Dumbbell version, under 60s" style={inp}
              onFocus={e => e.target.style.borderColor='#7c3aed'} onBlur={e => e.target.style.borderColor='#2a2a2a'} />
          </div>
        )}
        <button onClick={save} disabled={saving} style={{ padding: '14px', background: flash ? '#16a34a' : '#7c3aed', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', transition: 'background 0.2s' }}>
          {flash ? '✓ Saved!' : saving ? 'Saving…' : 'Save links'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({ ex, index, t, day, customLinks, onLinksUpdate, done, onToggleDone, log, onLogSaved }) {
  const [open, setOpen]         = useState(false);
  const [logOpen, setLogOpen]   = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const key       = `${day}__${ex.name}`;
  const custom    = customLinks[key] || {};
  const yt        = custom.yt        ?? ex.yt;
  const short     = custom.short     ?? ex.short;
  const shortNote = custom.shortNote ?? ex.shortNote;
  const isCustom  = !!customLinks[key];
  const isLogged  = !!log;

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${logOpen ? t.accent + '66' : open ? t.accent + '44' : done ? t.accent + '33' : '#1e1e1e'}`,
      background: done ? t.dim : open ? '#1a1a1a' : '#131313',
      transition: 'all 0.2s',
      overflow: 'visible',
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center' }}>

        {/* Checkbox — opens log sheet if not done */}
        <button onClick={() => done ? onToggleDone(index) : setLogOpen(true)} style={{
          width: 52, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 7,
            border: `2px solid ${done ? t.accent : '#2a2a2a'}`,
            background: done ? t.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}>
            {done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
          </div>
        </button>

        {/* Content */}
        <button onClick={() => setOpen(o => !o)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: t.badge, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{index + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: done ? t.accent : '#f0f0f0', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }}>{ex.name}</span>
            {isCustom && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: t.dim, color: t.accent }}>CUSTOM</span>}
          </div>

          {isLogged ? (
            <div style={{ marginTop: 6, paddingLeft: 32 }}>
              <LogSummary log={log} accent={t.accent} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, paddingLeft: 32 }}>
              <span style={{ fontSize: 12, color: '#555' }}>{ex.sets} sets · {ex.reps} reps</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: t.dim, color: t.accent }}>{ex.muscle}</span>
            </div>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', flexShrink: 0 }}>
          {/* Log button */}
          <button onClick={() => setLogOpen(true)} title="Log workout" style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isLogged ? t.dim : 'transparent',
            border: `1px solid ${isLogged ? t.accent + '55' : '#2a2a2a'}`,
            borderRadius: 8, color: isLogged ? t.accent : '#444',
            cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
          }}>
            {isLogged ? '📊' : '📋'}
          </button>

          {/* Expand */}
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', pointerEvents: 'none' }}>▼</div>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 16px 16px 16px', borderTop: `1px solid ${t.accent}22` }}>
          <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7, marginTop: 14, marginBottom: 0 }}>{ex.desc}</p>
          <div style={{ marginTop: 12, padding: '10px 14px', background: t.dim, borderLeft: `3px solid ${t.accent}`, borderRadius: '0 8px 8px 0', fontSize: 13, color: t.accent, fontWeight: 500 }}>
            🎯 You should feel: {ex.feel}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            {yt ? (
              <a href={yt} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#1a0000', border: '1px solid #ff000033', borderRadius: 10, textDecoration: 'none', color: '#ff6666', fontSize: 13, fontWeight: 600 }}>
                <span style={{ fontSize: 20 }}>▶</span>
                <div><div>Full Tutorial</div><div style={{ fontSize: 10, color: '#ff444466', fontWeight: 400, marginTop: 1 }}>In-depth technique</div></div>
              </a>
            ) : (
              <div style={{ flex: 1, padding: '12px 14px', background: '#111', border: '1px dashed #1e1e1e', borderRadius: 10, color: '#333', fontSize: 12, display: 'flex', alignItems: 'center' }}>No tutorial link</div>
            )}
            {short ? (
              <a href={short} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, textDecoration: 'none', color: '#ccc', fontSize: 13, fontWeight: 600 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <div><div>Quick Short</div><div style={{ fontSize: 10, color: '#555', fontWeight: 400, marginTop: 1 }}>{shortNote || '30 sec recap'}</div></div>
              </a>
            ) : (
              <div style={{ flex: 1, padding: '12px 14px', background: '#111', border: '1px dashed #1e1e1e', borderRadius: 10, color: '#333', fontSize: 12, display: 'flex', alignItems: 'center' }}>No short yet</div>
            )}
            <button onClick={() => setEditOpen(true)} title="Edit video links" style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCustom ? t.dim : '#111', border: `1px solid ${isCustom ? t.accent + '44' : '#2a2a2a'}`, borderRadius: 10, color: isCustom ? t.accent : '#444', cursor: 'pointer', fontSize: 17, position: 'relative', flexShrink: 0 }}>
              ✎
              {isCustom && <span style={{ position: 'absolute', top: 7, right: 7, width: 5, height: 5, borderRadius: '50%', background: t.accent }} />}
            </button>
          </div>

          <LinkEditorSheet day={day} exercise={ex} current={{ yt, short, shortNote }} open={editOpen} onSaved={updated => onLinksUpdate(key, updated)} onClose={() => setEditOpen(false)} />
        </div>
      )}

      {/* Log sheet */}
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} ex={ex} day={day} existingLog={log} t={t} onSaved={payload => {
        onToggleDone(index, true); // mark done
        onLogSaved(ex.name, payload);
      }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GymPlan() {
  const todayIndex  = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const [activeDay, setActiveDay]     = useState(Math.min(todayIndex, 6));
  const [customLinks, setCustomLinks] = useState({});
  const [done, setDone]               = useState({});
  const [logs, setLogs]               = useState({});  // keyed by exercise name

  useEffect(() => {
    fetch('/api/gym-links').then(r => r.json()).then(rows => {
      const map = {};
      rows.forEach(r => { map[`${r.day}__${r.exercise}`] = { yt: r.yt, short: r.short, shortNote: r.short_note }; });
      setCustomLinks(map);
    });

    const saved = localStorage.getItem(`gym-done-${new Date().toDateString()}`);
    if (saved) setDone(JSON.parse(saved));

    // Load today's workout logs
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/workout-logs?date=${today}`).then(r => r.json()).then(rows => {
      const map = {};
      rows.forEach(r => { map[r.exercise] = r; });
      setLogs(map);
    }).catch(() => {});
  }, []);

  function toggleDone(dayKey, index, forceTrue = false) {
    const key = `${dayKey}-${index}`;
    setDone(prev => {
      const next = { ...prev, [key]: forceTrue ? true : !prev[key] };
      localStorage.setItem(`gym-done-${new Date().toDateString()}`, JSON.stringify(next));
      return next;
    });
  }

  function handleLogSaved(exerciseName, payload) {
    setLogs(prev => ({ ...prev, [exerciseName]: payload }));
  }

  const current        = days[activeDay];
  const t              = themes[current.theme];
  const completedCount = current.exercises.filter((_, i) => done[`${current.day}-${i}`]).length;
  const loggedCount    = current.exercises.filter(ex => logs[ex.name]).length;
  const progress       = current.exercises.length > 0 ? completedCount / current.exercises.length : 0;

  return (
    <div style={{ background: '#0d0d0d', color: '#e8e8e8' }}>

      {/* Day selector */}
      <div className="gym-day-strip" style={{ display: 'flex', overflowX: 'auto', gap: 6, padding: '14px 12px', background: '#111', borderBottom: '1px solid #1e1e1e', scrollbarWidth: 'none' }}>
        {days.map((d, i) => {
          const dt = themes[d.theme];
          const isActive = i === activeDay;
          const isTdy    = i === Math.min(todayIndex, 6);
          return (
            <button key={d.day} onClick={() => setActiveDay(i)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '9px 14px', borderRadius: 12, minWidth: 58, position: 'relative',
              border: isActive ? `2px solid ${dt.accent}` : '2px solid transparent',
              background: isActive ? `${dt.accent}18` : 'transparent',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 18 }}>{d.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? dt.accent : '#444', letterSpacing: 0.5 }}>{d.day}</span>
              {isTdy && <span style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: dt.accent }} />}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div style={{ background: `linear-gradient(160deg, ${t.bg} 0%, #0d0d0d 70%)`, borderBottom: `1px solid ${t.accent}22`, padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: t.dim, border: `1px solid ${t.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{current.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>{current.label}</div>
            <span style={{ display: 'inline-block', marginTop: 5, background: t.badge, color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>{current.focus}</span>
          </div>
          {current.exercises.length > 0 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.accent }}>{completedCount}/{current.exercises.length}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
                {loggedCount > 0 ? `${loggedCount} logged` : 'exercises'}
              </div>
            </div>
          )}
        </div>

        {current.exercises.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 5, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress * 100}%`, background: t.accent, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: '#444' }}>{completedCount} done · {loggedCount} logged</span>
              <span style={{ fontSize: 11, color: '#444' }}>{Math.round(progress * 100)}%</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, padding: '10px 14px', background: `${t.accent}12`, border: `1px solid ${t.accent}25`, borderRadius: 10, fontSize: 13, color: '#999', lineHeight: 1.6 }}>
          💡 {current.tip}
        </div>
      </div>

      {/* Exercises */}
      <div className="gym-content" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {current.exercises.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🛌</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#555' }}>Rest & Recover</div>
            <div style={{ marginTop: 8, fontSize: 14, color: '#333', lineHeight: 1.8 }}>Your muscles grow on rest days.<br />Sleep 7–9 hrs. Stay hydrated.</div>
          </div>
        ) : (
          current.exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.name}
              ex={ex}
              index={i}
              t={t}
              day={current.day}
              customLinks={customLinks}
              onLinksUpdate={(key, updated) => setCustomLinks(prev => ({ ...prev, [key]: updated }))}
              done={!!done[`${current.day}-${i}`]}
              onToggleDone={(idx, force) => toggleDone(current.day, idx, force)}
              log={logs[ex.name] ?? null}
              onLogSaved={handleLogSaved}
            />
          ))
        )}

        {current.exercises.length > 0 && progress === 1 && (
          <div style={{ marginTop: 8, padding: '20px', borderRadius: 14, background: `${t.accent}18`, border: `1px solid ${t.accent}44`, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>Workout complete!</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {loggedCount === current.exercises.length
                ? `All ${loggedCount} exercises logged. Great work!`
                : `${loggedCount}/${current.exercises.length} exercises logged. Don't forget to log!`}
            </div>
          </div>
        )}
      </div>

      {/* Weekly overview */}
      <div style={{ margin: '0 12px 32px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>This Week</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {days.map((d, i) => {
            const dt = themes[d.theme]; const isActive = i === activeDay;
            return (
              <div key={d.day} onClick={() => setActiveDay(i)} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: isActive ? `${dt.accent}22` : '#161616', border: `1px solid ${isActive ? dt.accent + '55' : '#1e1e1e'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16 }}>{d.icon}</div>
                <div style={{ fontSize: 9, color: isActive ? dt.accent : '#333', marginTop: 4, fontWeight: 700, letterSpacing: 0.5 }}>{d.day}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
