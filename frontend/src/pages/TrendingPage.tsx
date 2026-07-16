import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Play, Pause, Heart, Flame, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Song } from '../context/AudioContext';

const ACCENT = '#1DB954';

const AUDIO_POOL = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
];

const COVER_POOL = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
];

const FALLBACK_SONGS: Song[] = [
  { id: 'tr1', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: COVER_POOL[0], audioUrl: AUDIO_POOL[0], duration: 200000 },
  { id: 'tr2', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', genre: 'Pop', coverUrl: COVER_POOL[1], audioUrl: AUDIO_POOL[1], duration: 203000 },
  { id: 'tr3', title: 'Peaches', artist: 'Justin Bieber', album: 'Justice', genre: 'R&B', coverUrl: COVER_POOL[2], audioUrl: AUDIO_POOL[2], duration: 198000 },
  { id: 'tr4', title: 'Stay', artist: 'The Kid LAROI, Justin Bieber', album: 'Stay', genre: 'Pop', coverUrl: COVER_POOL[3], audioUrl: AUDIO_POOL[3], duration: 141000 },
  { id: 'tr5', title: 'Industry Baby', artist: 'Lil Nas X', album: 'Montero', genre: 'Hip-Hop', coverUrl: COVER_POOL[4], audioUrl: AUDIO_POOL[4], duration: 212000 },
  { id: 'tr6', title: 'Bad Habits', artist: 'Ed Sheeran', album: '=', genre: 'Pop', coverUrl: COVER_POOL[5], audioUrl: AUDIO_POOL[5], duration: 231000 },
  { id: 'tr7', title: 'Kiss Me More', artist: 'Doja Cat, SZA', album: 'Planet Her', genre: 'Pop', coverUrl: COVER_POOL[6], audioUrl: AUDIO_POOL[6], duration: 215000 },
  { id: 'tr8', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: COVER_POOL[7], audioUrl: AUDIO_POOL[7], duration: 215000 },
];

const PLAY_COUNTS = [23849120, 19204030, 18570440, 17384920, 15922800, 14330100, 13877650, 12543900];
type Trend = 'up' | 'down' | 'same';
const TRENDS: Trend[] = ['up', 'up', 'same', 'up', 'down', 'up', 'same', 'down'];

const GENRE_BARS = [
  { genre: 'Pop', pct: 85, color: '#1DB954' },
  { genre: 'Hip-Hop', pct: 72, color: '#F59E0B' },
  { genre: 'R&B', pct: 61, color: '#8B5CF6' },
  { genre: 'Electronic', pct: 54, color: '#06B6D4' },
  { genre: 'Rock', pct: 40, color: '#EF4444' },
  { genre: 'Latin', pct: 33, color: '#EC4899' },
];

function fmtPlays(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function TrendingPage() {
  const { playSong, currentSong, isPlaying, togglePlay, toggleLike, likedSongs } = useAudio();
  const [songs, setSongs] = useState<Song[]>(FALLBACK_SONGS);

  useEffect(() => {
    fetch('/api/trending?limit=20')
      .then(r => r.ok ? r.json() : null)
      .then((data: { results?: Song[] } | null) => {
        if (data?.results?.length) {
          setSongs(data.results.map((s, i) => ({
            ...s,
            audioUrl: s.audioUrl || AUDIO_POOL[i % AUDIO_POOL.length],
            coverUrl: s.coverUrl || COVER_POOL[i % COVER_POOL.length],
          })));
        }
      })
      .catch(() => {});
  }, []);

  const TrendIcon = ({ t }: { t: Trend }) => {
    if (t === 'up') return <ChevronUp size={14} style={{ color: ACCENT }} />;
    if (t === 'down') return <ChevronDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-white/30" />;
  };

  return (
    <motion.div
      className="space-y-8 pb-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-2xl px-6 py-8"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame size={20} style={{ color: '#F59E0B' }} />
            <span className="text-sm font-bold text-white/60 uppercase tracking-widest">This Week</span>
          </div>
          <h1 className="text-3xl font-black text-white">Trending Now</h1>
          <p className="mt-1 text-sm text-white/50">Top tracks climbing the charts right now</p>
        </div>
        <TrendingUp size={48} className="hidden md:block" style={{ color: ACCENT, opacity: 0.4 }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart list — takes 2 cols */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="text-lg font-bold text-white mb-3">Top 20 Chart</h2>
          {songs.slice(0, 20).map((song, i) => {
            const rank = i + 1;
            const trend = TRENDS[i % TRENDS.length];
            const plays = PLAY_COUNTS[i % PLAY_COUNTS.length];
            const active = currentSong?.id === song.id;
            const liked = likedSongs.some(s => s.id === song.id);

            return (
              <motion.div
                key={song.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
                style={{
                  background: active ? 'rgba(29,185,84,0.08)' : 'rgba(40,40,40,0.5)',
                  border: `1px solid ${active ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.05)'}`,
                }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.005 }}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {rank <= 3 ? (
                    <span className="text-lg font-black" style={{
                      color: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'
                    }}>
                      {rank}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-white/30">{rank}</span>
                  )}
                </div>

                {/* Trend */}
                <TrendIcon t={trend} />

                {/* Cover */}
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg">
                  <img src={song.coverUrl} alt="" className="h-full w-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => active ? togglePlay() : playSong(song, songs)}>
                  <p className="truncate text-sm font-semibold" style={{ color: active ? ACCENT : '#fff' }}>{song.title}</p>
                  <p className="truncate text-xs text-white/40">{song.artist}</p>
                </div>

                <span className="hidden text-xs text-white/30 sm:block">{fmtPlays(plays)} plays</span>
                <span className="hidden text-xs text-white/30 md:block">{fmt(song.duration)}</span>

                <button onClick={() => toggleLike(song)} style={{ color: liked ? ACCENT : 'rgba(255,255,255,0.25)' }}>
                  <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => active ? togglePlay() : playSong(song, songs)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-black transition hover:scale-110"
                  style={{ background: ACCENT }}
                >
                  {active && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Sidebar — genre breakdown */}
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="mb-4 text-base font-bold text-white">Genre Breakdown</h3>
            <div className="space-y-3">
              {GENRE_BARS.map(({ genre, pct, color }) => (
                <div key={genre}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{genre}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hot right now */}
          <div className="rounded-2xl p-5" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="mb-4 text-base font-bold text-white flex items-center gap-2">
              <Flame size={16} style={{ color: '#F59E0B' }} /> Hot Right Now
            </h3>
            <div className="space-y-3">
              {songs.slice(0, 5).map((song, i) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => playSong(song, songs)}
                >
                  <span className="text-xs font-bold w-4 text-center text-white/30">{i + 1}</span>
                  <img src={song.coverUrl} alt="" className="h-9 w-9 rounded-md object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{song.title}</p>
                    <p className="truncate text-[10px] text-white/40">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
