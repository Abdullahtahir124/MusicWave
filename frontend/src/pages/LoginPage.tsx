import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Music2, User, UserRound } from 'lucide-react';
import { registerAccount, loginAccount } from '../api/client';

// Spotify green accent
const ACCENT = '#1DB954';

interface LoginPageProps {
  onLogin: (email: string) => void;
  onSpotifyLogin?: () => Promise<void> | void;
  spotifyEnabled?: boolean;
}

type Mode = 'signup' | 'login';

interface StoredUser {
  email: string;
  password: string;
  name: string;
}

const STORAGE_KEY = 'musify_users';

const formMotion = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const fieldMotion = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } },
};

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as StoredUser[];
  } catch {
    return [];
  }
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

export function LoginPage({ onLogin, onSpotifyLogin, spotifyEnabled = false }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>(() => readUsers().length > 0 ? 'login' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);

  const helperCopy = useMemo(() => (
    mode === 'signup'
      ? 'Pick a username and password to create your account.'
      : 'Enter your username and password to sign in.'
  ), [mode]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const cleanUsername = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanUsername.split('@')[0] || 'Listener';
    setError('');

    if (!cleanUsername || !password) {
      setError('Username and password are required.');
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Use at least 6 characters for the password.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      try {
        const res = await registerAccount(cleanUsername, password, cleanName);
        localStorage.setItem('musify_token', res.token);
        localStorage.setItem('musify_current_user', JSON.stringify({
          username: res.user.username,
          name: res.user.displayName,
        }));
        const users = readUsers();
        if (!users.some(u => u.email === cleanUsername)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...users, {
            email: cleanUsername,
            password,
            name: cleanName,
          }]));
        }
        onLogin(res.user.displayName || res.user.username);
      } catch (err: unknown) {
        const anyErr = err as any;
        const detail = anyErr?.response?.data?.detail || anyErr?.message || 'Registration failed.';
        setError(detail);
      }
      return;
    }

    try {
      const res = await loginAccount(cleanUsername, password);
      localStorage.setItem('musify_token', res.token);
      localStorage.setItem('musify_current_user', JSON.stringify({
        username: res.user.username,
        name: res.user.displayName,
      }));
      onLogin(res.user.displayName || res.user.username);
    } catch (err: unknown) {
      const anyErr = err as any;
      const detail = anyErr?.response?.data?.detail || anyErr?.message || 'Login failed.';
      setError(detail);
    }
  };

  return (
    <div className="auth-stage min-h-screen w-full overflow-hidden bg-[#121212] text-white">
      <div className="auth-backdrop" aria-hidden />
      <motion.div
        className="auth-device auth-device-left"
        initial={{ opacity: 0, rotate: -18, y: 80 }}
        animate={{ opacity: 1, rotate: -12, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      >
        <div className="auth-device-screen">
          <Logo />
          <p className="mt-12 text-lg font-black">Login your account</p>
          <div className="mt-8 h-3 w-44 rounded-full bg-white/10" />
          <div className="mt-4 h-3 w-52 rounded-full bg-white/10" />
          <div className="mt-6 h-10 rounded-md" style={{ background: ACCENT }} />
        </div>
      </motion.div>

      <motion.div
        className="auth-device auth-device-right"
        initial={{ opacity: 0, rotate: 18, y: 90 }}
        animate={{ opacity: 1, rotate: 12, y: 0 }}
        transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      >
        <div className="auth-device-screen auth-poster">
          <div className="auth-tip">Enjoy the best music here</div>
        </div>
      </motion.div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8 lg:px-8">
        <motion.section
          className="auth-panel grid w-full max-w-[1040px] overflow-hidden rounded-[8px]"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div className="auth-form-pane" variants={formMotion} initial="hidden" animate="show">
            <motion.div variants={fieldMotion}>
              <Logo />
            </motion.div>
            <motion.div className="mt-10" variants={fieldMotion}>
              <p className="text-xl font-black">
                {mode === 'signup' ? 'Signup your account' : 'Login your account'}
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
                <span>Username</span>
                <div>
                  <User size={15} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'signup' ? 'Choose a username' : 'Enter your username'} autoComplete="username" type="text" />
                </div>
              </motion.label>

              <motion.label className="auth-field" variants={fieldMotion}>
                <span>Password</span>
                <div>
                  <Lock size={15} />
                  <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} type={showPw ? 'text' : 'password'} />
                  <button type="button" onClick={() => setShowPw(value => !value)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </motion.label>

              {mode === 'signup' && (
                <motion.label className="auth-field" variants={fieldMotion}>
                  <span>Confirm Password</span>
                  <div>
                    <Lock size={15} />
                    <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" type={showPw ? 'text' : 'password'} />
                  </div>
                </motion.label>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p
                    className={error.startsWith('Account created') ? 'auth-message success' : 'auth-message'}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button className="auth-submit" variants={fieldMotion} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="submit">
                {mode === 'signup' ? 'Create New Account' : 'Login'}
              </motion.button>
            </motion.form>

            {spotifyEnabled && (
              <motion.button
                type="button"
                className="mt-4 rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-4 py-2 text-sm font-semibold text-[#60A5FA] transition hover:bg-[#60A5FA]/20"
                variants={fieldMotion}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  try {
                    setError('');
                    setIsSpotifyLoading(true);
                    await onSpotifyLogin?.();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unable to start Spotify sign-in.');
                  } finally {
                    setIsSpotifyLoading(false);
                  }
                }}
              >
                {isSpotifyLoading ? 'Redirecting…' : 'Continue with Spotify'}
              </motion.button>
            )}

            <motion.button className="mt-5 text-xs text-white/45 transition hover:text-[#60A5FA]" variants={fieldMotion} onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
              {mode === 'signup' ? 'Have an account? Login to your account' : "Don't have an account? Register now"}
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
