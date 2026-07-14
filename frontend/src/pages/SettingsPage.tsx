import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Music, Palette, Bell, Shield, ChevronRight,
  Volume2, Zap, Globe, Moon,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';

const ACCENT = '#1DB954';

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

export function SettingsPage() {
  const { setVolumeLevel, volume } = useAudio();

  // Profile
  const [displayName, setDisplayName] = useState('Listener');
  const [editingName, setEditingName] = useState(false);

  // Playback
  const [autoPlay, setAutoPlay] = useState(true);
  const [crossfade, setCrossfade] = useState(false);
  const [normalizeVolume, setNormalizeVolume] = useState(true);
  const [quality, setQuality] = useState('High (320kbps)');

  // Appearance
  const [language, setLanguage] = useState('English');
  const [compactMode, setCompactMode] = useState(false);

  // Notifications
  const [newReleases, setNewReleases] = useState(true);
  const [recommendations, setRecommendations] = useState(true);
  const [activityFeed, setActivityFeed] = useState(false);

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
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                  style={{ background: '#282828', border: `1px solid ${ACCENT}` }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                />
                <button onClick={() => setEditingName(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-black"
                  style={{ background: ACCENT }}>
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">{displayName}</p>
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
        <Toggle checked={autoPlay} onChange={setAutoPlay} label="Autoplay"
          description="Continue playing similar tracks when your queue ends" />
        <Toggle checked={crossfade} onChange={setCrossfade} label="Crossfade"
          description="Smooth transition between tracks" />
        <Toggle checked={normalizeVolume} onChange={setNormalizeVolume} label="Normalize Volume"
          description="Set the same volume level for all tracks" />
        <SelectRow label="Streaming Quality" description="Higher quality uses more data"
          options={['Normal (96kbps)', 'High (160kbps)', 'High (320kbps)', 'Very High (FLAC)']}
          value={quality} onChange={setQuality} />
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
        <Toggle checked={compactMode} onChange={setCompactMode} label="Compact Mode"
          description="Show smaller track rows for more content" />
        <SelectRow label="Language"
          options={['English', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Portuguese']}
          value={language} onChange={setLanguage} />
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Moon size={16} className="text-white/40" />
            <p className="text-sm font-semibold text-white">Theme</p>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {['Dark', 'System'].map(t => (
              <button key={t} className="px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: t === 'Dark' ? ACCENT : 'transparent', color: t === 'Dark' ? '#000' : 'rgba(255,255,255,0.5)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <Toggle checked={newReleases} onChange={setNewReleases} label="New Releases"
          description="Get notified when artists you follow release new music" />
        <Toggle checked={recommendations} onChange={setRecommendations} label="Recommendations"
          description="Personalised music suggestions" />
        <Toggle checked={activityFeed} onChange={setActivityFeed} label="Activity Feed"
          description="See what your friends are listening to" />
      </Section>

      {/* Account */}
      <Section title="Account" icon={Shield}>
        <button className="flex w-full items-center justify-between py-3 text-left">
          <div>
            <p className="text-sm font-semibold text-white">Change Password</p>
            <p className="text-xs text-white/40">Update your account password</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
        <button className="flex w-full items-center justify-between py-3 text-left">
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
          <button className="rounded-full px-4 py-1.5 text-xs font-bold text-black"
            style={{ background: ACCENT }}>
            Upgrade
          </button>
        </div>
        <div className="py-3">
          <div className="flex items-center gap-2 text-xs text-white/25">
            <Globe size={12} />
            <span>MusicWave v2.0 · © 2025</span>
          </div>
        </div>
      </Section>
    </motion.div>
  );
}
