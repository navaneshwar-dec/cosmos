'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import BottomSheet from '../components/BottomSheet';
import Login from '../components/Login';

const MyDay     = dynamic(() => import('../components/MyDay'),     { ssr: false });
const Todo      = dynamic(() => import('../components/Todo'),      { ssr: false });
const Work      = dynamic(() => import('../components/Work'),      { ssr: false });
const Finances  = dynamic(() => import('../components/Finances'),  { ssr: false });
const GymPlan   = dynamic(() => import('../components/GymPlan'),   { ssr: false });
const Prayers   = dynamic(() => import('../components/Prayers'),   { ssr: false });
const Assistant = dynamic(() => import('../components/Assistant'), { ssr: false });
const Vault     = dynamic(() => import('../components/Vault'),     { ssr: false });
const Diary     = dynamic(() => import('../components/Diary'),     { ssr: false });
const Files     = dynamic(() => import('../components/Files'),     { ssr: false });

// Finance (local SQLite) and the AI Assistant (local Ollama/Open WebUI) only work on
// the Mac. This flag is set in .env.local but NOT on Vercel, so those tabs vanish in prod.
const LOCAL_ONLY = process.env.NEXT_PUBLIC_LOCAL_FEATURES === '1';

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0d0d0d', gap: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.8 }}>
        cosmos<span style={{ color: '#7c3aed' }}>.</span>
      </div>
      <div style={{ width: 32, height: 32, border: '3px solid #1e1e1e', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Admin panel ───────────────────────────────────────────────────────────────

function AdminPanel({ open, onClose }) {
  const [users, setUsers]   = useState(null);
  const [saving, setSaving] = useState({});

  async function load() {
    if (users) return;
    const res = await fetch('/api/admin/users');
    setUsers(await res.json());
  }

  async function togglePrayer(userId, current) {
    setSaving(s => ({ ...s, [userId]: true }));
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, prayer_enabled: !current }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, prayer_enabled: !current } : u));
    setSaving(s => ({ ...s, [userId]: false }));
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Admin · Users">
      <div style={{ padding: '8px 20px 36px' }} onPointerEnter={load}>
        {/* Trigger load when sheet opens */}
        {open && !users && (() => { load(); return null; })()}

        <div style={{ fontSize: 11, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
          Manage access
        </div>

        {!users ? (
          <div style={{ textAlign: 'center', color: '#333', padding: 32 }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#333', padding: 32 }}>No users yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 14,
              }}>
                {/* Avatar */}
                {u.picture ? (
                  <img src={u.picture} alt="" width={40} height={40} style={{ borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#7c3aed22', border: '1px solid #7c3aed44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {u.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || u.email}
                    {u.is_admin && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#7c3aed22', color: '#a78bfa' }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
                {/* Prayer toggle */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>ప్రార్థన</div>
                  <button
                    onClick={() => togglePrayer(u.id, u.prayer_enabled)}
                    disabled={saving[u.id]}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: u.prayer_enabled ? '#f59e0b' : '#1e1e1e',
                      position: 'relative', opacity: saving[u.id] ? 0.5 : 1,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, transition: 'left 0.2s',
                      left: u.prayer_enabled ? 25 : 3,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 12, color: '#333', textAlign: 'center', lineHeight: 1.6 }}>
          Prayer tab changes take effect on the user's next sign-in.
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ open, onClose, session, onAdmin, workMode, onToggleWorkMode }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: '/' });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Account">
      <div style={{ padding: '8px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Profile card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16 }}>
          {session.user.image ? (
            <img src={session.user.image} alt="" width={52} height={52} style={{ borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#7c3aed22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {session.user.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
            {session.user.isAdmin && (
              <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#7c3aed22', color: '#a78bfa', letterSpacing: 1 }}>ADMIN</span>
            )}
          </div>
        </div>

        {/* Work mode toggle */}
        <button onClick={onToggleWorkMode} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
          background: workMode ? '#7c3aed18' : '#141414',
          border: `1px solid ${workMode ? '#7c3aed66' : '#2a2a2a'}`, borderRadius: 14,
          cursor: 'pointer', textAlign: 'left', transition: 'background .15s, border-color .15s',
        }}>
          <span style={{ fontSize: 20 }}>💼</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: workMode ? '#a78bfa' : '#ccc', fontSize: 14, fontWeight: 600 }}>Work mode</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Show only Work in the nav bar</div>
          </div>
          {/* switch */}
          <span style={{ width: 42, height: 25, borderRadius: 13, flexShrink: 0, background: workMode ? '#7c3aed' : '#2e2e2e', position: 'relative', transition: 'background .18s' }}>
            <span style={{ position: 'absolute', top: 3, left: workMode ? 20 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left .18s cubic-bezier(0.32,0.72,0,1)' }} />
          </span>
        </button>

        {/* Admin panel button */}
        {session.user.isAdmin && (
          <button onClick={() => { onClose(); setTimeout(onAdmin, 200); }} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14,
            color: '#ccc', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div>
              <div>Admin Panel</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Manage users &amp; prayer access</div>
            </div>
          </button>
        )}

        {/* Sign out */}
        <button onClick={handleSignOut} disabled={signingOut} style={{
          padding: '15px', background: '#1a0505', border: '1px solid #ef444433',
          borderRadius: 14, color: '#ef4444', fontSize: 14, fontWeight: 700,
          cursor: signingOut ? 'default' : 'pointer', opacity: signingOut ? 0.6 : 1,
        }}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'IMDB Watchlist', href: 'https://www.imdb.com/watchlist', color: '#f5c518', icon: '⭐' },
];

function LinksSheet({ open, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Quick Links">
      <div style={{ padding: '8px 20px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {QUICK_LINKS.map(link => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '15px 18px',
              background: '#141414', border: `1px solid ${link.color}33`,
              borderRadius: 14, color: link.color,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 22 }}>{link.icon}</span>
            <div>
              <div>{link.label}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2, fontWeight: 400 }}>{link.href.replace('https://', '')}</div>
            </div>
            <svg style={{ marginLeft: 'auto', opacity: 0.3 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        ))}
      </div>
    </BottomSheet>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [active, setActive]     = useState('myday');
  const [userMenu, setUserMenu] = useState(false);
  const [adminOpen, setAdmin]   = useState(false);
  const [linksOpen, setLinks]   = useState(false);
  const [vaultOpen, setVault]   = useState(false);
  const [diaryOpen, setDiary]   = useState(false);
  const [filesOpen, setFiles]   = useState(false);
  const [assistantOpen, setAssistant] = useState(false);
  const [workMode, setWorkMode] = useState(false);

  // restore work mode (per-device) after mount to avoid SSR hydration mismatch
  useEffect(() => {
    try {
      if (localStorage.getItem('cosmos_work_mode') === '1') { setWorkMode(true); setActive('work'); }
    } catch {}
  }, []);

  function toggleWorkMode() {
    setWorkMode(v => {
      const next = !v;
      try { localStorage.setItem('cosmos_work_mode', next ? '1' : '0'); } catch {}
      if (next) setActive('work');
      return next;
    });
  }

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return <Suspense fallback={<LoadingScreen />}><Login /></Suspense>;

  // Session exists but DB write failed during sign-in — user record not created yet
  if (!session.user.id) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0d0d0d', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.8, marginBottom: 24 }}>
          cosmos<span style={{ color: '#7c3aed' }}>.</span>
        </div>
        <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>Session setup failed</div>
        {session.user.dbError && (
          <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 12, padding: '8px 14px', background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 8, maxWidth: 360, wordBreak: 'break-all', lineHeight: 1.5 }}>
            {session.user.dbError}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#444', marginBottom: 32, lineHeight: 1.7 }}>
          Couldn't connect to the database during sign-in.<br />Please sign out and try again.
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })} style={{ padding: '13px 28px', background: '#7c3aed', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Sign out &amp; retry
        </button>
      </div>
    );
  }

  const { prayerEnabled, isAdmin } = session.user;

  const tabs = workMode
    ? [{ id: 'work', label: 'Work', icon: TabWorkIcon }]
    : [
        { id: 'myday',     label: 'My Day',    icon: TabMyDayIcon },
        { id: 'todo',      label: 'Tasks',     icon: TabTaskIcon },
        { id: 'work',      label: 'Work',      icon: TabWorkIcon },
        ...(LOCAL_ONLY ? [{ id: 'finances', label: 'Finance', icon: TabFinanceIcon }] : []),
        { id: 'gym',       label: 'Gym',       icon: TabGymIcon },
        ...(prayerEnabled ? [{ id: 'prayers', label: 'ప్రార్థన', icon: TabPrayerIcon }] : []),
      ];

  return (
    <>
      <header className="app-header">
        <span style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: -0.6 }}>
          cosmos<span style={{ color: '#7c3aed' }}>.</span>
        </span>
        <div style={{ flex: 1 }} />
        {/* Assistant */}
        {LOCAL_ONLY && (
          <button onClick={() => setAssistant(true)} title="Assistant" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#444', display: 'flex', alignItems: 'center', marginRight: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
              <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
            </svg>
          </button>
        )}
        {/* Files */}
        <button onClick={() => setFiles(true)} title="Files" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#444', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6a2 2 0 012-2h3l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
          </svg>
        </button>
        {/* Diary */}
        <button onClick={() => setDiary(true)} title="Diary" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#444', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z" />
            <path d="M8 2v20" />
          </svg>
        </button>
        {/* Vault */}
        <button onClick={() => setVault(true)} title="Password vault" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#444', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </button>
        {/* Quick links */}
        <button onClick={() => setLinks(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#444', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        {/* User avatar */}
        <button onClick={() => setUserMenu(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name}
              width={30} height={30}
              style={{ borderRadius: '50%', display: 'block', border: '2px solid #2a2a2a' }}
            />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>
              {session.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </button>
      </header>

      <main className="app-content">
        {active === 'myday'    && <MyDay />}
        {active === 'todo'     && <Todo />}
        {active === 'work'     && <Work />}
        {active === 'finances' && LOCAL_ONLY && <Finances />}
        {active === 'gym'      && <GymPlan />}
        {active === 'prayers'  && prayerEnabled && <Prayers />}
      </main>

      <nav className="app-bottom-nav">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const isPrayer = id === 'prayers';
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? (isPrayer ? '#f59e0b' : '#a78bfa') : '#444',
                transition: 'color 0.15s', position: 'relative',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 32, height: 2,
                  background: isPrayer ? '#f59e0b' : '#7c3aed',
                  borderRadius: '0 0 4px 4px',
                }} />
              )}
              <Icon active={isActive} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: 0.2 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      <UserMenu
        open={userMenu}
        onClose={() => setUserMenu(false)}
        session={session}
        onAdmin={() => setAdmin(true)}
        workMode={workMode}
        onToggleWorkMode={toggleWorkMode}
      />
      <LinksSheet open={linksOpen} onClose={() => setLinks(false)} />
      <Vault open={vaultOpen} onClose={() => setVault(false)} />
      <Diary open={diaryOpen} onClose={() => setDiary(false)} />
      <Files open={filesOpen} onClose={() => setFiles(false)} />
      {LOCAL_ONLY && <Assistant open={assistantOpen} onClose={() => setAssistant(false)} />}
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdmin(false)} />}
    </>
  );
}

// ─── Tab icons ─────────────────────────────────────────────────────────────────

function TabTaskIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function TabFinanceIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function TabGymIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6h0M18 6h0M6 18h0M18 18h0" strokeWidth="3" strokeLinecap="round"/>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="18" />
    </svg>
  );
}

function TabMyDayIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="4" />
      <path d="M12 3v2M5.6 6.6l1.4 1.4M18.4 6.6l-1.4 1.4M3 13h2M19 13h2M2 20h20" />
    </svg>
  );
}

function TabWorkIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function TabAssistantIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function TabPrayerIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#555'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C9 2 7 5 7 8c0 2 1 3.5 2.5 4.5" />
      <path d="M12 2c3 0 5 3 5 6 0 2-1 3.5-2.5 4.5" />
      <path d="M7 12.5C5 14 4 16 4 18h16c0-2-1-4-3-5.5" />
      <path d="M9.5 12.5C10.5 13.5 11 15 11 17" />
      <path d="M14.5 12.5C13.5 13.5 13 15 13 17" />
    </svg>
  );
}
