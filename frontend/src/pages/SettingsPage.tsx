import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Music, Palette, Bell, Shield, ChevronRight,
  Volume2, Zap, Globe, Moon, X, Check,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useToast } from '../store/toastStore';

const ACCENT = '#1DB954';
const PREFS_KEY = 'musify_preferences';

interface Preferences {
  displayName: string;
  autoPlay: boolean;
  crossfade: boolean;
  normalizeVolume: boolean;
  quality: string;
  language: string;
  compactMode: boolean;
  theme: string;
  newReleases: boolean;
  recommendations: boolean;
  activityFeed: boolean;
}

const DEFAULTS: Preferences = {
  displayName: 'Listener',
  autoPlay: true,
  crossfade: false,
  normalizeVolume: true,
  quality: 'High (320kbps)',
  language: 'English',
  compactMode: false,
  theme: 'Dark',
  newReleases: true,
  recommendations: true,
  activityFeed: false,
};

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function savePrefs(prefs: Preferences) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 rounded-full transition-all duration-200 flex-shrink-0"
        style={{ background: checked ? ACCENT : 'rgba(255,255,255,0.15)' }}
        aria-checked={checked}
        role="switch"
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? '1.375rem' : '0.125rem' }}
        />
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.06)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'rgba(29,185,84,0.12)' }}>
          <Icon size={16} style={{ color: ACCENT }} />
        </div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-5 divide-y divide-white/[0.04]">{children}</div>
    </motion.div>
  );
}

function SelectRow({ label, description, options, value, onChange }: {
  label: string; description?: string;
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer"
        style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

interface PasswordModalProps {
  onClose: () => void;
}

function PasswordModal({ onClose }: PasswordModalProps) {
  const { addToast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const handleSave = () => {
    setErr('');
    if (!current || !next) { setErr('All fields required.'); return; }
    if (next.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setErr('Passwords do not match.'); return; }
    // Update the locally-stored user record if present
    try {
      const raw = localStorage.getItem('musify_users');
      const users: Array<{ email: string; password: string; name: string }> = raw ? JSON.parse(raw) : [];
      const stored = localStorage.getItem('musify_current_user');
      const currentUser = stored ? JSON.parse(stored) : null;
      const email = currentUser?.email;
      if (email) {
        const idx = users.findIndex(u => u.email === email);
        if (idx >= 0 && users[idx].password && users[idx].password !== current) {
          setErr('Current password is incorrect.');
          return;
        }
        if (idx >= 0) {
          users[idx].password = next;
        } else {
          users.push({ email, password: next, name: currentUser.name || email });
        }
        localStorage.setItem('musify_users', JSON.stringify(users));
      }
    } catch {}
    addToast('Password updated', 'success');
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.1)' }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">Change Password</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }} />
          <input type="password" value={next} onChange={e => setNext(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }} />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }} />
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 rounded-full py-2.5 text-sm font-bold text-black"
            style={{ background: ACCENT }}>
            Update
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface PrivacyModalProps {
  onClose: () => void;
  prefs: { publicProfile: boolean; shareListening: boolean; analytics: boolean };
  onChange: (next: { publicProfile: boolean; shareListening: boolean; analytics: boolean }) => void;
}

function PrivacyModal({ onClose, prefs, onChange }: PrivacyModalProps) {
  const [local, setLocal] = useState(prefs);
  const { addToast } = useToast();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.1)' }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">Privacy Settings</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          <Toggle checked={local.publicProfile}
            onChange={v => setLocal({ ...local, publicProfile: v })}
            label="Public profile"
            description="Let other users find and view your profile" />
          <Toggle checked={local.shareListening}
            onChange={v => setLocal({ ...local, shareListening: v })}
            label="Share listening activity"
            description="Show what you're playing to friends" />
          <Toggle checked={local.analytics}
            onChange={v => setLocal({ ...local, analytics: v })}
            label="Anonymous analytics"
            description="Help improve MusicWave by sharing usage data" />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={() => { onChange(local); addToast('Privacy settings saved', 'success'); onClose(); }}
            className="flex-1 rounded-full py-2.5 text-sm font-bold text-black"
            style={{ background: ACCENT }}>
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SettingsPage() {
  const { setVolumeLevel, volume } = useAudio();
  const { addToast } = useToast();

  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());
  const [privacy, setPrivacy] = useState(() => {
    try {
      const raw = localStorage.getItem('musify_privacy');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { publicProfile: false, shareListening: false, analytics: true };
  });
  const [editingName, setEditingName] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showUpgraded, setShowUpgraded] = useState(false);

  useEffect(() => { savePrefs(prefs); }, [prefs]);
  useEffect(() => {
    try { localStorage.setItem('musify_privacy', JSON.stringify(privacy)); } catch {}
  }, [privacy]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    if (key !== 'displayName') addToast('Preference saved', 'info');
  };

  return (
    <motion.div
      className="space-y-6 pb-8 max-w-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={User}>
        <div className="py-5 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-black"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #158a3e)`, color: '#000' }}>
            {prefs.displayName[0]?.toUpperCase() || 'L'}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={prefs.displayName}
                  onChange={e => update('displayName', e.target.value)}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                  style={{ background: '#282828', border: `1px solid ${ACCENT}` }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); addToast('Name updated', 'success'); } }}
                />
                <button onClick={() => { setEditingName(false); addToast('Name updated', 'success'); }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-black"
                  style={{ background: ACCENT }}>
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">{prefs.displayName}</p>
                <button onClick={() => setEditingName(true)}
                  className="text-xs px-2 py-0.5 rounded" style={{ color: ACCENT }}>Edit</button>
              </div>
            )}
            <p className="text-xs text-white/40 mt-0.5">Free Plan</p>
          </div>
        </div>
      </Section>

      {/* Playback */}
      <Section title="Playback" icon={Music}>
        <Toggle checked={prefs.autoPlay} onChange={v => update('autoPlay', v)} label="Autoplay"
          description="Continue playing similar tracks when your queue ends" />
        <Toggle checked={prefs.crossfade} onChange={v => update('crossfade', v)} label="Crossfade"
          description="Smooth transition between tracks" />
        <Toggle checked={prefs.normalizeVolume} onChange={v => update('normalizeVolume', v)} label="Normalize Volume"
          description="Set the same volume level for all tracks" />
        <SelectRow label="Streaming Quality" description="Higher quality uses more data"
          options={['Normal (96kbps)', 'High (160kbps)', 'High (320kbps)', 'Very High (FLAC)']}
          value={prefs.quality} onChange={v => update('quality', v)} />
        <div className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-white/40" />
            <div>
              <p className="text-sm font-semibold text-white">Master Volume</p>
              <p className="text-xs text-white/40">{Math.round(volume * 100)}%</p>
            </div>
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVolumeLevel(parseFloat(e.target.value))}
            className="w-32 cursor-pointer accent-green-500"
          />
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" icon={Palette}>
        <Toggle checked={prefs.compactMode} onChange={v => update('compactMode', v)} label="Compact Mode"
          description="Show smaller track rows for more content" />
        <SelectRow label="Language"
          options={['English', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Portuguese']}
          value={prefs.language} onChange={v => update('language', v)} />
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Moon size={16} className="text-white/40" />
            <p className="text-sm font-semibold text-white">Theme</p>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {['Dark', 'System'].map(t => (
              <button key={t}
                onClick={() => update('theme', t)}
                className="px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: prefs.theme === t ? ACCENT : 'transparent', color: prefs.theme === t ? '#000' : 'rgba(255,255,255,0.5)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <Toggle checked={prefs.newReleases} onChange={v => update('newReleases', v)} label="New Releases"
          description="Get notified when artists you follow release new music" />
        <Toggle checked={prefs.recommendations} onChange={v => update('recommendations', v)} label="Recommendations"
          description="Personalised music suggestions" />
        <Toggle checked={prefs.activityFeed} onChange={v => update('activityFeed', v)} label="Activity Feed"
          description="See what your friends are listening to" />
      </Section>

      {/* Account */}
      <Section title="Account" icon={Shield}>
        <button
          onClick={() => setShowPassword(true)}
          className="flex w-full items-center justify-between py-3 text-left transition hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-white">Change Password</p>
            <p className="text-xs text-white/40">Update your account password</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
        <button
          onClick={() => setShowPrivacy(true)}
          className="flex w-full items-center justify-between py-3 text-left transition hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-white">Privacy Settings</p>
            <p className="text-xs text-white/40">Control your data and privacy</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
        <div className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap size={14} style={{ color: '#F59E0B' }} /> Upgrade to Premium
            </p>
            <p className="text-xs text-white/40">Ad-free, offline listening &amp; more</p>
          </div>
          <button
            onClick={() => { setShowUpgraded(true); addToast('Upgrade coming soon!', 'info'); }}
            className="rounded-full px-4 py-1.5 text-xs font-bold text-black"
            style={{ background: ACCENT }}>
            Upgrade
          </button>
        </div>
        <div className="py-3">
          <div className="flex items-center gap-2 text-xs text-white/25">
            <Globe size={12} />
            <span>MusicWave v2.0 · © 2026</span>
          </div>
        </div>
      </Section>

      {/* Modals */}
      <AnimatePresence>
        {showPassword && <PasswordModal onClose={() => setShowPassword(false)} />}
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} prefs={privacy} onChange={setPrivacy} />}
        {showUpgraded && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUpgraded(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6 text-center"
              style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Zap size={32} style={{ color: '#F59E0B' }} />
              </div>
              <h3 className="text-xl font-black text-white">Premium coming soon</h3>
              <p className="mt-3 text-sm text-white/60">
                Ad-free listening, offline downloads, and higher audio quality are on the way.
              </p>
              <button
                onClick={() => setShowUpgraded(false)}
                className="mt-6 w-full rounded-full py-2.5 text-sm font-bold text-black"
                style={{ background: ACCENT }}>
                <Check size={14} className="inline mr-1" /> Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
