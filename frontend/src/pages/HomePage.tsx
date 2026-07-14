import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Heart, ChevronRight } from 'lucide-react';
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
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400',
];

const FALLBACK_SONGS: Song[] = [
  { id: 'mw1', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: COVER_POOL[0], audioUrl: AUDIO_POOL[0], duration: 200000 },
  { id: 'mw2', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', genre: 'Pop', coverUrl: COVER_POOL[1], audioUrl: AUDIO_POOL[1], duration: 203000 },
  { id: 'mw3', title: 'Sunrise Shine', artist: 'Alan Walker', album: 'Neon Set', genre: 'Electronic', coverUrl: COVER_POOL[2], audioUrl: AUDIO_POOL[2], duration: 158000 },
  { id: 'mw4', title: 'Stay', artist: 'The Kid LAROI, Justin Bieber', album: 'Stay', genre: 'Pop', coverUrl: COVER_POOL[3], audioUrl: AUDIO_POOL[3], duration: 141000 },
  { id: 'mw5', title: 'Industry Baby', artist: 'Lil Nas X, Jack Harlow', album: 'Montero', genre: 'Hip-Hop', coverUrl: COVER_POOL[4], audioUrl: AUDIO_POOL[4], duration: 212000 },
  { id: 'mw6', title: 'Bad Habits', artist: 'Ed Sheeran', album: '=', genre: 'Pop', coverUrl: COVER_POOL[5], audioUrl: AUDIO_POOL[5], duration: 231000 },
  { id: 'mw7', title: 'Kiss Me More', artist: 'Doja Cat, SZA', album: 'Planet Her', genre: 'R&B', coverUrl: COVER_POOL[6], audioUrl: AUDIO_POOL[6], duration: 215000 },
  { id: 'mw8', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: COVER_POOL[7], audioUrl: AUDIO_POOL[7], duration: 215000 },
];

const MOODS = [
  { label: 'Happy', emoji: '😊', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { label: 'Chill', emoji: '😌', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  { label: 'Energetic', emoji: '⚡', color: ACCENT, bg: 'rgba(29,185,84,0.12)' },
  { label: 'Sad', emoji: '💙', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  { label: 'Focus', emoji: '🎯', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  { label: 'Party', emoji: '🎉', color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function SongRow({ song, queue, index }: { song: Song; queue: Song[]; index: number }) {
  const { playSong, currentSong, isPlaying, togglePlay, toggleLike, likedSongs } = useAudio();
  const active = currentSong?.id === song.id;
  const liked = likedSongs.some(s => s.id === song.id);

  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all cursor-pointer"
      style={{
        background: active ? 'rgba(29,185,84,0.08)' : 'transparent',
        border: `1px solid ${active ? 'rgba(29,185,84,0.2)' : 'transparent'}`,
      }}
      whileHover={{ backgroundColor: active ? 'rgba(29,185,84,0.1)' : 'rgba(255,255,255,0.04)' }}
      onClick={() => active ? togglePlay() : playSong(song, queue)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <span className="w-5 text-center text-xs text-white/25">{index + 1}</span>
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg">
        <img src={song.coverUrl} alt="" className="h-full w-full object-cover" />
        {active && isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center gap-0.5"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            {[...Array(3)].map((_, j) => (
              <div key={j} className="w-0.5 rounded-full animate-bounce"
                style={{ height: `${6 + j * 3}px`, background: ACCENT, animationDelay: `${j * 0.1}s` }} />
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: active ? ACCENT : '#fff' }}>{song.title}</p>
        <p className="truncate text-xs text-white/40">{song.artist}</p>
      </div>
      <span className="hidden text-xs text-white/25 sm:block">{fmt(song.duration)}</span>
      <button
        onClick={e => { e.stopPropagation(); toggleLike(song); }}
        className="transition hover:scale-110"
        style={{ color: liked ? ACCENT : 'rgba(255,255,255,0.25)' }}
      >
        <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
      </button>
    </motion.div>
  );
}

export function HomePage({ user }: { user?: string }) {
  const { playSong, currentSong, isPlaying, togglePlay, recentPlays } = useAudio();
  const [featured, setFeatured] = useState<Song[]>(FALLBACK_SONGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/featured')
      .then(r => r.ok ? r.json() : null)
      .then((data: { results?: Song[] } | null) => {
        if (data?.results?.length) {
          setFeatured(data.results.map((s, i) => ({
            ...s,
            audioUrl: s.audioUrl || AUDIO_POOL[i % AUDIO_POOL.length],
            coverUrl: s.coverUrl || COVER_POOL[i % COVER_POOL.length],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heroSong = currentSong || featured[0];
  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <motion.div
      className="space-y-8 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Greeting */}
      <div className="pt-2">
        <h2 className="text-2xl font-black text-white">
          {greet()}{user ? `, ${user}` : ''}!
        </h2>
        <p className="mt-1 text-sm text-white/45">What do you want to listen to today?</p>
      </div>

      {/* Hero banner */}
      {heroSong && (
        <motion.div
          className="relative overflow-hidden rounded-2xl"
          style={{ minHeight: '260px' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <img
            src={heroSong.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'blur(1px) brightness(0.4)' }}
          />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' }} />
          <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
              {currentSong ? '▶ Now Playing' : 'Featured Track'}
            </p>
            <h1 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl leading-tight mb-1">
              {heroSong.title}
            </h1>
            <p className="text-sm text-white/60 mb-4">{heroSong.artist} · {heroSong.album}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => currentSong?.id === heroSong.id ? togglePlay() : playSong(heroSong, featured)}
                className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-black transition hover:scale-105 active:scale-95"
                style={{ background: ACCENT, boxShadow: `0 0 24px rgba(29,185,84,0.4)` }}
              >
                {isPlaying && currentSong?.id === heroSong.id
                  ? <><Pause size={16} fill="currentColor" /> Pause</>
                  : <><Play size={16} fill="currentColor" /> Play</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recently Played */}
      {recentPlays.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Recently Played</h2>
            <button className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition">
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 carousel-scroll">
            {recentPlays.slice(0, 8).map((song, i) => {
              const active = currentSong?.id === song.id;
              return (
                <motion.div
                  key={song.id}
                  className="group flex-shrink-0 w-36 cursor-pointer rounded-xl p-3 transition-all duration-200"
                  style={{ background: '#181818', border: `1px solid ${active ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -3 }}
                  onClick={() => active ? togglePlay() : playSong(song, recentPlays)}
                >
                  <div className="relative mb-2 aspect-square overflow-hidden rounded-lg">
                    <img src={song.coverUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ background: ACCENT }}>
                        {active && isPlaying
                          ? <Pause size={14} fill="#000" color="#000" />
                          : <Play size={14} fill="#000" color="#000" />}
                      </div>
                    </div>
                  </div>
                  <p className="truncate text-xs font-semibold text-white">{song.title}</p>
                  <p className="truncate text-[10px] text-white/40">{song.artist}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured tracks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Featured Tracks</h2>
          <span className="text-xs text-white/30">Full songs</span>
        </div>
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {featured.slice(0, 10).map((song, i) => (
              <SongRow key={song.id} song={song} queue={featured} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Mood categories */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3">Browse by Mood</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {MOODS.map((mood, i) => (
            <motion.button
              key={mood.label}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 font-semibold transition-all duration-200"
              style={{ background: mood.bg, border: `1px solid ${mood.color}25` }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05, borderColor: mood.color + '60' }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs" style={{ color: mood.color }}>{mood.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* New Releases — carousel */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">New Releases</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 carousel-scroll">
          {featured.slice(0, 8).map((song, i) => {
            const active = currentSong?.id === song.id;
            return (
              <motion.div
                key={song.id + '-nr'}
                className="group flex-shrink-0 w-40 cursor-pointer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => active ? togglePlay() : playSong(song, featured)}
              >
                <div className="relative mb-2 aspect-square overflow-hidden rounded-xl">
                  <img src={song.coverUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: ACCENT, boxShadow: `0 0 16px rgba(29,185,84,0.5)` }}>
                      {active && isPlaying
                        ? <Pause size={16} fill="#000" color="#000" />
                        : <Play size={16} fill="#000" color="#000" />}
                    </div>
                  </div>
                  {i < 3 && (
                    <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-black"
                      style={{ background: ACCENT }}>NEW</span>
                  )}
                </div>
                <p className="truncate text-sm font-semibold text-white">{song.title}</p>
                <p className="truncate text-xs text-white/40">{song.artist}</p>
              </motion.div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
