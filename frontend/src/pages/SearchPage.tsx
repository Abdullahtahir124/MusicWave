import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Play, Pause, Heart, Radio } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Song } from '../context/AudioContext';
import { useAnimationConfig } from '../hooks/useAnimationConfig';

const ACCENT = '#1DB954';

const API_BASE = import.meta.env.VITE_API_URL || '';

const GENRE_FILTERS = ['All', 'Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Jazz', 'Classical', 'Latin'];

const TRENDING_SEARCHES = [
  'Blinding Lights', 'Bad Guy', 'Shape of You', 'Levitating',
  'Stay', 'Peaches', 'Industry Baby', 'Montero',
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

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// Inline 30-sec preview player for Deezer tracks
function PreviewPlayer({ previewUrl }: { previewUrl: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.addEventListener('timeupdate', () => {
        const a = audioRef.current!;
        setProgress(a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0);
      });
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={{ background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.25)', cursor: 'pointer' }}
      onClick={toggle}
      title="Play 30-sec preview"
    >
      <Radio size={12} style={{ color: ACCENT }} />
      <span style={{ color: ACCENT }}>Preview</span>
      {playing ? <Pause size={11} style={{ color: ACCENT }} /> : <Play size={11} style={{ color: ACCENT }} />}
      {playing && (
        <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: ACCENT }} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    available: { label: 'Available', color: '#1DB954', bg: 'rgba(29,185,84,0.12)' },
    preview: { label: 'Sample Audio', color: '#D29922', bg: 'rgba(210,153,34,0.12)' },
    unavailable: { label: 'Not Available', color: '#F85149', bg: 'rgba(248,81,73,0.12)' },
  };
  const c = config[status || ''] ?? { label: 'Unknown', color: '#8b949e', bg: 'rgba(139,148,158,0.12)' };

  return (
    <span
      className="hidden items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold sm:inline-flex"
      style={{ color: c.color, background: c.bg }}
      aria-label={`Track ${c.label.toLowerCase()}`}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="skeleton h-12 w-12 flex-shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-40 rounded" />
        <div className="skeleton h-2.5 w-28 rounded" />
      </div>
      <div className="skeleton hidden h-3 w-10 rounded sm:block" />
      <div className="skeleton h-9 w-9 rounded-full" />
    </div>
  );
}

export function SearchPage() {
  const { playSong, currentSong, isPlaying, togglePlay, toggleLike, likedSongs } = useAudio();
  const anim = useAnimationConfig();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const activeQuery = query.trim();
    if (!activeQuery && genre === 'All') {
      setResults([]);
      setError('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        // /api/search/advanced supports q, genre, artist params
        const params = new URLSearchParams();
        if (activeQuery) params.set('q', activeQuery);
        if (genre !== 'All') params.set('genre', genre);

        const url = `${API_BASE}/api/search/advanced?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json() as { results: Song[] };
        const filled = (data.results ?? []).map((s, i) => ({
          ...s,
          coverUrl: s.coverUrl || COVER_POOL[i % COVER_POOL.length],
        }));
        setResults(filled);
      } catch {
        setError('Something went wrong. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 380);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, genre]);

  const handleTrending = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      className="space-y-8 pb-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Hero search bar */}
      <div
        className="relative rounded-2xl px-6 py-10 text-center"
        style={{
          background: 'linear-gradient(135deg, #1a2a1a 0%, #181818 60%, #0f1f0f 100%)',
          border: '1px solid rgba(29,185,84,0.12)',
        }}
      >
        <h1 className="mb-2 text-3xl font-black text-white">Search</h1>
        <p className="mb-6 text-sm text-white/50">Find songs, artists, albums and more</p>

        <div
          className="relative mx-auto max-w-2xl overflow-hidden rounded-full"
          style={{ background: '#282828', border: '2px solid rgba(29,185,84,0.3)' }}
        >
          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full bg-transparent py-4 pl-14 pr-14 text-base text-white outline-none placeholder:text-white/30"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Genre filter chips */}
      <div className="flex flex-wrap gap-2">
        {GENRE_FILTERS.map(g => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: genre === g ? ACCENT : 'rgba(255,255,255,0.07)',
              color: genre === g ? '#000' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${genre === g ? ACCENT : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Trending searches (shown when no query and no genre selected) */}
      <AnimatePresence mode="wait">
        {!(query.trim() || genre !== 'All') ? (
          <motion.div
            key="trending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="mb-4 text-lg font-bold text-white">Trending Searches</h2>
            <div className="flex flex-wrap gap-3">
              {TRENDING_SEARCHES.map((term, i) => (
                <motion.button
                  key={term}
                  onClick={() => handleTrending(term)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                  style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.08)' }}
                  whileHover={{ scale: 1.04, borderColor: 'rgba(29,185,84,0.3)' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Search size={13} style={{ color: ACCENT }} />
                  {term}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="region"
            aria-label="Search results"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white" aria-live="polite" aria-atomic="true">
                {loading ? 'Searching…' : results.length > 0 ? `${results.length} results` : 'No results'}
              </h2>
              {!loading && results.length > 0 && (
                <p className="text-xs text-white/40">Tap a track to play</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl p-4 text-sm text-white/70"
                style={{ background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)' }}>
                {error}
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}

            {/* Results grid */}
            {!loading && results.length > 0 && (
              <div className="space-y-2" role="list" aria-label="Search results list">
                {results.map((song, i) => {
                  const active = currentSong?.id === song.id;
                  const liked = likedSongs.some(s => s.id === song.id);
                  return (
                    <motion.div
                      key={song.id}
                      className="song-card flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        background: active ? 'rgba(29,185,84,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? 'rgba(29,185,84,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, ...anim.cardInteraction.transition }}
                      whileHover={{ ...anim.cardInteraction.whileHover, backgroundColor: active ? 'rgba(29,185,84,0.1)' : 'rgba(255,255,255,0.05)' }}
                      whileTap={anim.cardInteraction.whileTap}
                      tabIndex={0}
                      role="button"
                      aria-label={`${song.playbackStatus === 'unavailable' ? 'Unavailable:' : active && isPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (song.playbackStatus !== 'unavailable') {
                            active ? togglePlay() : playSong(song, results);
                          }
                        }
                      }}
                    >
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                        <img src={song.coverUrl} alt="" className="h-full w-full object-cover" />
                        {active && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <div className="flex gap-0.5">
                              {[...Array(3)].map((_, j) => (
                                <div key={j} className="w-0.5 rounded-full animate-bounce"
                                  style={{ height: `${8 + j * 3}px`, background: ACCENT, animationDelay: `${j * 0.1}s` }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0" onClick={() => active ? togglePlay() : playSong(song, results)} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold" style={{ color: active ? ACCENT : '#fff' }}>{song.title}</p>
                          <StatusBadge status={song.playbackStatus} />
                        </div>
                        <p className="truncate text-xs text-white/50">{song.artist} {song.album ? `• ${song.album}` : ''}</p>
                      </div>

                      <span className="hidden text-xs text-white/35 sm:block">{fmt(song.duration)}</span>

                      {/* 30-sec preview button — shown for any track that has an audio URL */}
                      {song.audioUrl && song.previewAvailable && (
                        <PreviewPlayer previewUrl={song.audioUrl} />
                      )}

                      <button onClick={() => toggleLike(song)}
                        style={{ color: liked ? ACCENT : 'rgba(255,255,255,0.3)' }}
                        className="transition hover:scale-110">
                        <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                      </button>

                      <motion.button
                        onClick={() => song.playbackStatus !== 'unavailable' && (active ? togglePlay() : playSong(song, results))}
                        className="play-btn flex h-9 w-9 items-center justify-center rounded-full text-black"
                        style={{
                          background: song.playbackStatus === 'unavailable' ? 'rgba(255,255,255,0.1)' : ACCENT,
                          cursor: song.playbackStatus === 'unavailable' ? 'not-allowed' : 'pointer',
                          opacity: song.playbackStatus === 'unavailable' ? 0.5 : 1,
                        }}
                        aria-label={song.playbackStatus === 'unavailable' ? 'Track not available' : active && isPlaying ? 'Pause' : 'Play'}
                        disabled={song.playbackStatus === 'unavailable'}
                        whileHover={song.playbackStatus !== 'unavailable' ? anim.buttonPress.whileHover : undefined}
                        whileTap={song.playbackStatus !== 'unavailable' ? anim.buttonPress.whileTap : undefined}
                      >
                        {active && isPlaying
                          ? <Pause size={14} fill="currentColor" />
                          : <Play size={14} fill="currentColor" />}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search size={48} className="mb-4 text-white/20" />
                <p className="text-lg font-semibold text-white/60">
                  No results {query.trim() ? `for "${query}"` : genre !== 'All' ? `for genre "${genre}"` : ''}
                </p>
                <p className="mt-1 text-sm text-white/30">Try a different title, artist or album</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}