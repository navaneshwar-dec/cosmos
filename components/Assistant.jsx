'use client';
import { useState, useEffect } from 'react';

export default function Assistant() {
  const [src, setSrc] = useState(null);
  const [micWarning, setMicWarning] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSrc(`http://${window.location.hostname}:3010`);
    setMicWarning(!window.isSecureContext);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0d0d0d' }}>
      {micWarning && (
        <div style={{
          padding: '8px 14px', fontSize: 12, color: '#fbbf24',
          background: '#f59e0b14', borderBottom: '1px solid #f59e0b33',
        }}>
          ⚠ Voice mode needs the mic, which browsers only allow over HTTPS or on localhost — open cosmos at <b>localhost:3000</b> on this Mac for Voice Call to work. Text chat works fine either way.
        </div>
      )}

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexDirection: 'column' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #1e1e1e', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#444' }}>Loading assistant…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {src && (
        <iframe
          src={src}
          onLoad={() => setLoaded(true)}
          allow="microphone; autoplay"
          style={{ width: '100%', height: '100%', border: 'none', opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
}
