'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function BottomSheet({ open, onClose, title, children }) {
  const startY = useRef(null);
  const sheetRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Swipe-down to close
  function onTouchStart(e) { startY.current = e.touches[0].clientY; }
  function onTouchEnd(e) {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 60) onClose();
    startY.current = null;
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(22, 20, 32, 0.82)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          borderTop: '1px solid var(--border-hi)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '92dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          animation: 'sheetUp 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 38, height: 4, background: '#2e2e2e', borderRadius: 2 }} />
        </div>

        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px 0',
          }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>{title}</span>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#222', border: 'none', borderRadius: '50%',
                color: '#888', fontSize: 18, cursor: 'pointer', lineHeight: 1,
              }}
            >×</button>
          </div>
        )}

        {children}
      </div>
    </div>,
    document.body
  );
}
