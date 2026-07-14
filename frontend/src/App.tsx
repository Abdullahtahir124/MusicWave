import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Grid2X2, Heart, Home, LogOut, Menu, Music2,
  Search, Settings, UsersRound, X,
} from 'lucide-react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { PlayerBar } from './components/PlayerBar';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { TrendingPage } from './pages/TrendingPage';
import { ArtistsPage } from './pages/ArtistsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LibraryPage } from './pages/LibraryPage';
import { useSpotify } from './context/SpotifyContext';

type TabId = 'home' | 'search' | 'trending' | 'library' | 'artists' | 'settings';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home',     label: 'Home',         icon: Home       },
  { id: 'search',   label: 'Search',       icon: Search     },
  { id: 'trending', label: 'Trending Now', icon: Heart      },
  { id: 'library',  label: 'Playlist',     icon: Grid2X2    },
  { id: 'artists',  label: 'Artists',      icon: UsersRound },
  { id: 'settings', label: 'Settings',     icon: Settings   },
];

// ── Spotify accent tokens ─────────────────────────────────────────────────────
const ACCENT      = '#1DB954';
const ACCENT_GLOW = 'rgba(29,185,84,0.55)';
const BG_DEEP     = '#121212';
const BG_BASE     = '#181818';
const BG_SIDEBAR  = 'rgba(18,18,18,0.97)';

function Dashboard({ user, onLogout }: { user: string; onLogout: () => void }) {
  const { playSong, recentPlays } = useAudio();
  const [tab,         setTab]        = useState<TabId>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = () => {
    setAccountOpen(false);
    onLogout();
  };

  return (
    <div
      className="relative flex h-screen w-screen overflow-hidden text-white"
      style={{ background: `linear-gradient(135deg, ${BG_DEEP} 0%, ${BG_BASE} 60%, #121212 100%)` }}
    >
      {/* Ambient blue radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(circle at 80% 10%, rgba(29,185,84,0.12), transparent 36%),
             radial-gradient(circle at 15% 85%, rgba(21,138,62,0.08), transparent 30%)`,
        }}
        aria-hidden
      />

      {/* ── Sidebar ── */}
      <motion.aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-shrink-0 flex-col transition-transform duration-300 lg:sticky ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          width: '246px',
          background: BG_SIDEBAR,
          borderRight: '1px solid rgba(29,185,84,0.08)',
          backdropFilter: 'blur(24px)',
        }}
        initial={{ x: -246, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-8 py-7">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #158a3e)`,
              boxShadow: `0 0 18px ${ACCENT_GLOW}`,
            }}
          >
            <Music2 size={19} color="#fff" strokeWidth={2.5} />
          </div>
          <p
            className="text-xl font-black tracking-tight text-white"
            style={{ fontFamily: 'Poppins' }}
          >
            Music<span style={{ color: ACCENT }}>Wave</span>
          </p>
        </div>

        {/* User card */}
        <div className="flex flex-col items-center px-4 pb-6">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140&h=140&fit=crop"
              alt=""
              className="h-14 w-14 rounded-xl object-cover"
              style={{ border: `2px solid rgba(29,185,84,0.25)` }}
            />
            <span
              className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2"
              style={{ background: '#22C55E', borderColor: BG_SIDEBAR }}
            />
          </div>
          <p className="mt-2.5 max-w-[160px] truncate text-sm font-bold text-white">{user}</p>
          <p className="mt-0.5 text-[10px] font-semibold" style={{ color: ACCENT }}>
            Premium Member
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <motion.button
              key={id}
              onClick={() => { setTab(id); setSidebarOpen(false); }}
              className={`musify-nav-item flex w-full items-center gap-4 rounded-xl px-5 py-3.5 text-left text-sm font-semibold transition-all duration-200 ${tab === id ? 'active' : ''}`}
              style={{
                color:      tab === id ? ACCENT : 'rgba(255,255,255,0.6)',
                background: tab === id ? 'rgba(29,185,84,0.1)' : 'transparent',
                border:     tab === id ? `1px solid rgba(29,185,84,0.2)` : '1px solid transparent',
              }}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={17} />
              <span>{label}</span>
            </motion.button>
          ))}
        </nav>

        {/* Recently played */}
        {recentPlays.length > 0 && (
          <div className="mt-5 px-4">
            <p
              className="px-2 text-[10px] font-bold uppercase tracking-[2px]"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Recently Played
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {recentPlays.slice(0, 3).map(song => (
                <button
                  key={song.id}
                  onClick={() => playSong(song, recentPlays)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,185,84,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <img
                    src={song.coverUrl}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">{song.title}</span>
                    <span className="block truncate text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {song.artist}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Logout */}
        <div className="border-t p-4" style={{ borderColor: 'rgba(29,185,84,0.08)' }}>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#f87171';
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </motion.aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* ── Main ── */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top nav */}
        <header
          className="sticky top-0 z-30 flex h-[68px] items-center gap-4 px-5 lg:px-8"
          style={{
            background: 'rgba(18,18,18,0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(29,185,84,0.07)',
          }}
        >
          <button
            className="rounded-xl p-2 transition-all duration-200 lg:hidden"
            style={{ color: 'rgba(255,255,255,0.55)' }}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,185,84,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand name in header on mobile */}
          <p
            className="text-lg font-black tracking-tight lg:hidden"
            style={{ fontFamily: 'Poppins' }}
          >
            Music<span style={{ color: ACCENT }}>Wave</span>
          </p>

          <div className="flex-1" />

          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200"
            style={{ background: 'rgba(29,185,84,0.08)', color: 'rgba(255,255,255,0.65)' }}
            aria-label="Notifications"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,185,84,0.16)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,185,84,0.08)'; }}
          >
            <Bell size={17} />
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
              style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT_GLOW}` }}
            />
          </button>

          <div className="relative">
            <motion.button
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #158a3e)`,
                color: '#fff',
                boxShadow: `0 0 16px ${ACCENT_GLOW}`,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setAccountOpen(open => !open)}
              aria-label="Open account menu"
              aria-expanded={accountOpen}
            >
              {user[0].toUpperCase()}
            </motion.button>

            <AnimatePresence>
              {accountOpen && (
                <motion.div
                  className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border p-2 shadow-2xl"
                  style={{
                    background: 'rgba(18,18,18,0.96)',
                    borderColor: 'rgba(29,185,84,0.18)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 0 28px rgba(29,185,84,0.12)',
                  }}
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="border-b px-3 pb-2 pt-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <p className="truncate text-sm font-bold text-white">{user}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">Signed in</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white/70 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '96px' }}>
          <div className="mx-auto w-full max-w-[1480px] px-5 pb-6 lg:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                {tab === 'home'     && <HomePage user={user} />}
                {tab === 'search'   && <SearchPage />}
                {tab === 'trending' && <TrendingPage />}
                {tab === 'library'  && <LibraryPage />}
                {tab === 'artists'  && <ArtistsPage />}
                {tab === 'settings' && <SettingsPage />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav (sits above PlayerBar) ── */}
      <nav
        className="fixed left-0 right-0 z-40 flex h-[65px] items-center justify-around lg:hidden"
        style={{
          bottom: '90px',
          background: 'rgba(18,18,18,0.95)',
          backdropFilter: 'blur(24px)',
          borderTop: `1px solid rgba(29,185,84,0.12)`,
        }}
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex flex-col items-center gap-1 px-3 py-2 text-[9px] font-bold transition-all duration-200"
            style={{ color: tab === id ? ACCENT : 'rgba(255,255,255,0.4)' }}
          >
            <Icon
              size={19}
              style={tab === id ? { filter: `drop-shadow(0 0 6px ${ACCENT_GLOW})` } : {}}
            />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <PlayerBar />
    </div>
  );
}

function AppContent() {
  const [fallbackUser, setFallbackUser] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const handledAuthRef = useRef(false);
  const { user, isAuthenticated, isLoading, startAuth, completeAuth, logout } = useSpotify();

  useEffect(() => {
    if (handledAuthRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!code && !state && !error) return;

    handledAuthRef.current = true;

    void (async () => {
      try {
        if (error) throw new Error(error);
        if (!code || !state) throw new Error('Spotify sign-in did not return the expected data.');
        await completeAuth(code, state);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Spotify sign-in failed.');
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  }, [completeAuth]);

  const activeUser = user?.display_name || fallbackUser;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] text-sm text-white/70">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">Preparing your music experience...</div>
      </div>
    );
  }

  if (!isAuthenticated && !activeUser) {
    return <LoginPage onLogin={setFallbackUser} onSpotifyLogin={startAuth} spotifyEnabled={Boolean(import.meta.env.VITE_SPOTIFY_CLIENT_ID)} />;
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] p-6 text-center text-white">
        <div className="max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-6">
          <p className="text-lg font-semibold">Spotify sign-in was interrupted</p>
          <p className="mt-2 text-sm text-white/70">{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <AudioProvider>
      <Dashboard
        user={activeUser || 'Listener'}
        onLogout={() => {
          localStorage.removeItem('musify_current_user');
          setFallbackUser(null);
          logout();
        }}
      />
    </AudioProvider>
  );
}

export default function App() {
  return <AppContent />;
}
