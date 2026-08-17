'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Medical from './Medical';

const GymPlan   = dynamic(() => import('./GymPlan'),   { ssr: false });
const Nutrition = dynamic(() => import('./Nutrition'), { ssr: false });

const TABS = [
  { id: 'workouts',  label: 'Workouts',  icon: '🏋️' },
  { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
  { id: 'medical',   label: 'Medical',   icon: '🩺' },
];

export default function Health() {
  const [tab, setTab] = useState('workouts');
  return (
    <div>
      {/* Segmented control — sticky under the app header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 6, padding: '10px 12px',
        background: 'rgba(10,10,16,0.72)', backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--glass-1)', border: '1px solid var(--border)', borderRadius: 14, padding: 4 }}>
          {TABS.map(t => {
            const on = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 6px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
                border: '1px solid ' + (on ? 'var(--border-hi)' : 'transparent'),
                background: on ? 'var(--glass-hi)' : 'transparent',
                color: on ? 'var(--text)' : 'var(--text-dim)',
                fontSize: 13, fontWeight: on ? 700 : 600,
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'workouts'  && <GymPlan />}
      {tab === 'nutrition' && <Nutrition />}
      {tab === 'medical'   && <Medical embedded />}
    </div>
  );
}
