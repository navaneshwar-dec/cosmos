'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const error  = params.get('error');

  async function handleGoogle() {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', background: '#0d0d0d', padding: '0 32px',
    }}>
      {/* Glow backdrop */}
      <div style={{
        position: 'absolute', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, #7c3aed18 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -80%)',
        pointerEvents: 'none',
      }} />

      {/* Logo mark */}
      <CosmosMark />

      {/* Wordmark — Snell Roundhand on Apple devices matches the script logo */}
      <div style={{
        fontSize: 52, lineHeight: 1, color: '#fff', marginTop: 4,
        fontFamily: "'Snell Roundhand', 'Apple Chancery', 'Brush Script MT', cursive",
        fontWeight: 500, letterSpacing: 0.5,
        textShadow: '0 2px 24px rgba(124,58,237,0.35)',
      }}>Cosmos</div>

      <div style={{
        fontSize: 11, color: '#6a6685', letterSpacing: 3, textTransform: 'uppercase',
        marginTop: 10, marginBottom: error ? 24 : 52,
      }}>
        Precision in every decision
      </div>

      {error && (
        <div style={{
          marginBottom: 32, padding: '12px 18px', background: '#1a0505',
          border: '1px solid #ef444433', borderRadius: 12,
          fontSize: 13, color: '#ef4444', textAlign: 'center', lineHeight: 1.5,
          width: '100%', maxWidth: 340,
        }}>
          {error === 'AccessDenied'
            ? 'Sign-in failed — check the server logs for details.'
            : `Sign-in error: ${error}`}
        </div>
      )}

      {/* Google sign-in button */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '15px 28px',
          background: loading ? '#1a1a1a' : '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 14, cursor: loading ? 'default' : 'pointer',
          width: '100%', maxWidth: 340,
          boxShadow: loading ? 'none' : '0 4px 24px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <div style={{ width: 22, height: 22, border: '2.5px solid #ccc', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
        ) : (
          <GoogleLogo />
        )}
        <span style={{ fontSize: 15, fontWeight: 600, color: loading ? '#555' : '#1a1a1a', letterSpacing: 0.2 }}>
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </span>
      </button>

      <div style={{ marginTop: 24, fontSize: 12, color: '#2a2a2a', textAlign: 'center', lineHeight: 1.7 }}>
        Private &amp; personal — only your account can sign in.
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function CosmosMark() {
  const orbit  = 'rgba(206,201,228,0.42)';
  const bright = 'rgba(233,229,247,0.92)';
  const accent = '#a78bfa';
  const spark = (x, y, s, c = bright) =>
    `M${x},${y - s} L${x + s * 0.26},${y - s * 0.26} L${x + s},${y} L${x + s * 0.26},${y + s * 0.26} L${x},${y + s} L${x - s * 0.26},${y + s * 0.26} L${x - s},${y} L${x - s * 0.26},${y - s * 0.26} Z`;

  return (
    <svg width="160" height="134" viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block' }}>
      {/* orbital rings */}
      <g stroke={orbit} strokeWidth="1">
        <circle cx="112" cy="98" r="60" />
        <circle cx="150" cy="112" r="46" />
        <circle cx="122" cy="128" r="35" />
      </g>

      {/* tiny orbit markers */}
      <g fill={orbit}>
        <circle cx="60" cy="86" r="1.4" />
        <circle cx="172" cy="96" r="1.4" />
        <circle cx="104" cy="160" r="1.4" />
        <circle cx="166" cy="150" r="1.4" />
      </g>

      {/* crescent moon */}
      <path d="M98,22 A13,13 0 1,0 98,48 A10,10 0 1,1 98,22 Z" fill={bright} />

      {/* planets */}
      <circle cx="74" cy="118" r="5.5" fill={accent} />
      <circle cx="132" cy="152" r="4" fill={bright} />
      <circle cx="158" cy="94" r="3" fill={orbit} />

      {/* sparkles */}
      <path d={spark(58, 70, 6, bright)} fill={bright} />
      <path d={spark(178, 64, 5, bright)} fill={bright} />
      <path d={spark(196, 122, 4, accent)} fill={accent} />
      <path d={spark(150, 40, 4, bright)} fill={bright} />
      <path d={spark(90, 150, 5, accent)} fill={accent} />
      <path d={spark(48, 112, 3, bright)} fill={bright} />
      <path d={spark(120, 78, 3.5, bright)} fill={bright} />
      <path d={spark(138, 112, 3, bright)} fill={bright} />
      <path d={spark(176, 158, 3.5, bright)} fill={bright} />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
