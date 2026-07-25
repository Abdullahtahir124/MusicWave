import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Music2, UserRound } from 'lucide-react';
import { registerAccount, loginAccount, resendVerification } from '../api/client';

const ACCENT = '#1DB954';

interface LoginPageProps {
  onLogin: (displayName: string) => void;
  onSpotifyLogin?: () => Promise<void> | void;
  spotifyEnabled?: boolean;
}

type Mode = 'signup' | 'login';

const STORAGE_KEY = 'musify_users';

const formMotion = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fieldMotion = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

function readStoredUsers(): Array<{ email: string; password: string; name: string }> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Music2 size={22} style={{ color: ACCENT }} />
      <span className="text-2xl font-black tracking-tight text-white" style={{ fontFamily: 'Poppins' }}>
        Music<span style={{ color: ACCENT }}>Wave</span>
      </span>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage({ onLogin, onSpotifyLogin, spotifyEnabled = false }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending] = useState(false);

  const helperCopy = useMemo(() => (
    mode === 'signup'
      ? 'Enter a valid email address to create your account.'
      : 'Sign in with your email and password.'
  ), [mode]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirm('');
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0] || 'Listener';
    setError('');
    setSuccess('');

    // Validate
    if (!cleanEmail || !password) { setError('Email and password are required.'); return; }
    if (!EMAIL_RE.test(cleanEmail)) { setError('Please enter a valid email address.'); return; }

    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }

      setLoading(true);
      try {
        const res = await registerAccount(cleanEmail, password, cleanName);
        if (res.requiresVerification) {
          setPendingVerification(true);
          setPendingEmail(cleanEmail);
          setSuccess('Verification email sent! Check your inbox.');
          setLoading(false);
          return;
        }
        const users = readStoredUsers();
        if (!users.some(u => u.email === cleanEmail)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...users, { email: cleanEmail, password, name: cleanName }]));
        }
        if (res.token) {
          localStorage.setItem('musify_token', res.token);
          localStorage.setItem('musify_current_user', JSON.stringify({ email: res.user?.username, name: res.user?.displayName }));
        }
        setSuccess('Account created! Redirecting to login…');
        setTimeout(() => {
          switchMode('login');
          setEmail(cleanEmail);
        }, 1400);
      } catch (err: unknown) {
        const anyErr = err as any;
        const detail = anyErr?.response?.data?.detail || anyErr?.detail || anyErr?.message || '';
        if (!detail || detail.includes('fetch') || detail.includes('Network') || detail.includes('network')) {
          const users = readStoredUsers();
          if (users.some(u => u.email === cleanEmail)) {
            setError('An account with this email already exists.');
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...users, { email: cleanEmail, password, name: cleanName }]));
            setSuccess('Account created locally! Redirecting to login…');
            setTimeout(() => {
              switchMode('login');
              setEmail(cleanEmail);
            }, 1400);
          }
        } else {
          setError(detail);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // LOGIN
    setLoading(true);
    try {
      const res = await loginAccount(cleanEmail, password);
      localStorage.setItem('musify_token', res.token);
      localStorage.setItem('musify_current_user', JSON.stringify({ email: res.user.username, name: res.user.displayName }));
      onLogin(res.user.displayName || res.user.username);
    } catch (err: unknown) {
      const anyErr = err as any;
      const detail = anyErr?.response?.data?.detail || anyErr?.detail || anyErr?.message || '';
      const httpStatus = anyErr?.response?.status || anyErr?.status;
      if (httpStatus === 403 && detail.toLowerCase().includes('verify')) {
        setPendingVerification(true);
        setPendingEmail(cleanEmail);
        setError(detail);
      } else if (!detail || detail.includes('fetch') || detail.includes('Network') || detail.includes('network')) {
        const users = readStoredUsers();
        const match = users.find(u => u.email === cleanEmail && u.password === password);
        if (match) {
          localStorage.setItem('musify_current_user', JSON.stringify({ email: cleanEmail, name: match.name }));
          onLogin(match.name || cleanEmail);
        } else {
          setError('Invalid email or password.');
        }
      } else {
        setError(detail || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage min-h-screen w-full overflow-hidden bg-[#121212] text-white">
      <div className="auth-backdrop" aria-hidden />

      {/* Decorative devices — hidden on small screens */}
      <motion.div className="auth-device auth-device-left" initial={{ opacity: 0, rotate: -18, y: 80 }}
        animate={{ opacity: 1, rotate: -12, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} aria-hidden>
        <div className="auth-device-screen">
          <Logo />
          <p className="mt-12 text-lg font-black">Your music, everywhere.</p>
          <div className="mt-8 h-3 w-44 rounded-full bg-white/10" />
          <div className="mt-4 h-3 w-52 rounded-full bg-white/10" />
          <div className="mt-6 h-10 rounded-md" style={{ background: ACCENT }} />
        </div>
      </motion.div>

      <motion.div className="auth-device auth-device-right" initial={{ opacity: 0, rotate: 18, y: 90 }}
        animate={{ opacity: 1, rotate: 12, y: 0 }} transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} aria-hidden>
        <div className="auth-device-screen auth-poster">
          <div className="auth-tip">Enjoy the best music here</div>
        </div>
      </motion.div>

      {/* Verification pending overlay */}
      <AnimatePresence>
        {pendingVerification && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-5"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-8 text-center"
              style={{ background: '#1a1a1a', border: '1px solid rgba(29,185,84,0.2)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(29,185,84,0.1)' }}>
                <CheckCircle2 size={32} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-xl font-black text-white">Check your email</h2>
              <p className="mt-3 text-sm text-white/60">
                We sent a verification link to <strong className="text-white">{pendingEmail}</strong>. Click the link to activate your account.
              </p>
              <p className="mt-2 text-xs text-white/35">The link expires in 24 hours.</p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={async () => {
                    setResending(true);
                    try {
                      await resendVerification(pendingEmail);
                      setSuccess('Verification email resent!');
                    } catch {
                      setError('Could not resend. Please wait 60 seconds.');
                    } finally {
                      setResending(false);
                    }
                  }}
                  disabled={resending}
                  className="rounded-full px-6 py-2.5 text-sm font-semibold transition"
                  style={{ background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', color: ACCENT, opacity: resending ? 0.6 : 1 }}
                >
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
                <button
                  onClick={() => { setPendingVerification(false); setError(''); setSuccess(''); }}
                  className="text-xs text-white/40 transition hover:text-white"
                >
                  Back to login
                </button>
              </div>

              <AnimatePresence>
                {(error || success) && (
                  <motion.p
                    className={`mt-4 text-xs ${success ? 'text-green-400' : 'text-red-400'}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {success || error}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8 lg:px-8">
        <motion.section
          className="auth-panel grid w-full max-w-[1040px] overflow-hidden rounded-[8px]"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div className="auth-form-pane" variants={formMotion} initial="hidden" animate="show">
            <motion.div variants={fieldMotion}><Logo /></motion.div>

            <motion.div className="mt-10" variants={fieldMotion}>
              <p className="text-xl font-black">
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">{helperCopy}</p>
            </motion.div>

            <motion.form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate variants={formMotion} initial="hidden" animate="show">

              {mode === 'signup' && (
                <motion.label className="auth-field" variants={fieldMotion}>
                  <span>Display Name</span>
                  <div>
                    <UserRound size={15} />
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" autoComplete="name" />
                  </div>
                </motion.label>
              )}

              <motion.label className="auth-field" variants={fieldMotion}>
                <span>Email</span>
                <div>
                  <Mail size={15} />
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    type="email"
                    inputMode="email"
                  />
                </div>
              </motion.label>

              <motion.label className="auth-field" variants={fieldMotion}>
                <span>Password</span>
                <div>
                  <Lock size={15} />
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    type={showPw ? 'text' : 'password'}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide' : 'Show'}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </motion.label>

              {mode === 'signup' && (
                <motion.label className="auth-field" variants={fieldMotion}>
                  <span>Confirm Password</span>
                  <div>
                    <Lock size={15} />
                    <input
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      type={showPw ? 'text' : 'password'}
                    />
                  </div>
                </motion.label>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p className="auth-message" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    {error}
                  </motion.p>
                )}
                {success && (
                  <motion.p className="auth-message success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    {success}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                className="auth-submit"
                variants={fieldMotion}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
              >
                {loading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </motion.button>
            </motion.form>

            {spotifyEnabled && onSpotifyLogin && (
              <motion.button
                type="button"
                className="mt-4 w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                style={{ borderColor: 'rgba(29,185,84,0.3)', background: 'rgba(29,185,84,0.08)', color: ACCENT }}
                variants={fieldMotion}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  try { setIsSpotifyLoading(true); await onSpotifyLogin(); }
                  catch (err) { setError(err instanceof Error ? err.message : 'Spotify sign-in failed.'); }
                  finally { setIsSpotifyLoading(false); }
                }}
              >
                {isSpotifyLoading ? 'Redirecting…' : 'Continue with Spotify'}
              </motion.button>
            )}

            <motion.button
              className="mt-5 text-xs text-white/45 transition hover:text-white"
              variants={fieldMotion}
              onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
              type="button"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </motion.button>
          </motion.div>

          <div className="auth-art-pane">
            <div className="auth-tip">Enjoy the best music here</div>
            <div className="auth-musician" />
          </div>
        </motion.section>
      </main>
    </div>
  );
}
