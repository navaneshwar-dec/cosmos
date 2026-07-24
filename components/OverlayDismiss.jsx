'use client';
import { useEffect, useRef } from 'react';

// Shared "get me out of here" affordances for the full-screen overlays (Vault, Files,
// Diary, Assistant), which otherwise cover the header + bottom nav. Esc closes on
// desktop; the Grabber gives a visible pull-handle you can tap or swipe down to dismiss.

export function useOverlayDismiss(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function Grabber({ onClose }) {
  const startY = useRef(null);
  return (
    <div
      role="button"
      aria-label="Close"
      onClick={onClose}
      onTouchStart={e => { startY.current = e.touches[0].clientY; }}
      onTouchMove={e => {
        if (startY.current != null && e.touches[0].clientY - startY.current > 55) { startY.current = null; onClose(); }
      }}
      onTouchEnd={() => { startY.current = null; }}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 22, flexShrink: 0, cursor: 'pointer', touchAction: 'none' }}
    >
      <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border-hi)' }} />
    </div>
  );
}
