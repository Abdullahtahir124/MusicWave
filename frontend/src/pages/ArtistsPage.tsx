import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Pause, Heart, X, CheckCircle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Song } from '../context/AudioContext';

const ACCENT = '#1DB954';

interface Artist {
  id: string;
  name: string;
  image: string;
  genre: string;
  followers: number;
  monthlyListeners: number;
  color: string;
  songs: Song[];
}

const ARTISTS: Artist[] = [];

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function ArtistsPage() {
  const { playSong, currentSong, isPlaying, togglePlay, toggleLike, likedSongs } = useAudio();
  const [artists, setArtists] = useState<Artist[]>(ARTISTS);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch top artists from Deezer chart via a search proxy trick — hit our search endpoint
    // and gather unique artists, since /api/artists uses the CSV.
    fetch('https://api.deezer.com/chart/0/artists?limit=24')
      .then(res => res.ok ? res.json() : null)
      .then((data: { data?: Array<{ id: number; name: string; picture_medium: string }> } | null) => {
        if (!data?.data?.length) return;
        const colors = ['#8B0000', '#1a006b', '#5c3d00', '#6b006b', '#00456b', '#001a6b'];
        const genres = ['Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Rock', 'Latin'];
        setArtists(data.data.map((a, i) => ({
          id: String(a.id),
          name: a.name,
          image: a.picture_medium,
          genre: genres[i % genres.length],
          followers: 10_000_000 + Math.floor(Math.random() * 90_000_000),
          monthlyListeners: 8_000_000 + Math.floor(Math.random() * 80_000_000),
          color: colors[i % colors.length],
          songs: [],
        })));
      })
      .catch(() => {});
  }, []);

  const loadArtistTracks = async (artist: Artist) => {
    // Open panel immediately with whatever we have
    setSelected(artist);
    if (artist.songs.length > 0) return;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(artist.name)}`);
      if (!res.ok) return;
      const data = await res.json() as { results?: Song[] };
      if (!data.results?.length) return;
      const artistTracks = data.results
        .filter(s => s.artist.toLowerCase().includes(artist.name.toLowerCase()))
        .slice(0, 8);
      const updated = { ...artist, songs: artistTracks };
      setArtists(prev => prev.map(a => a.id === artist.id ? updated : a));
      setSelected(updated);
    } catch {}
  };

  const toggleFollow = (id: string) => {
    setFollowed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      className="space-y-8 pb-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'rgba(29,185,84,0.15)', border: '1px solid rgba(29,185,84,0.3)' }}>
          <Users size={20} style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Artists</h1>
          <p className="text-sm text-white/40">Discover and follow your favourite artists</p>
        </div>
      </div>

      {/* Artist grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {artists.map((artist, i) => {
          const isFollowing = followed.has(artist.id);
          return (
            <motion.div
              key={artist.id}
              className="song-card group flex flex-col items-center gap-2 cursor-pointer rounded-2xl p-4 text-center"
              style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4, borderColor: 'rgba(29,185,84,0.25)' }}
              onClick={() => loadArtistTracks(artist)}
              tabIndex={0}
              role="button"
              aria-label={`View ${artist.name}, ${artist.genre}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  loadArtistTracks(artist);
                }
              }}
            >
              <div className="relative h-20 w-20 overflow-hidden rounded-full"
                style={{ border: `2px solid ${isFollowing ? ACCENT : 'rgba(255,255,255,0.1)'}` }}>
                <img src={artist.image} alt={artist.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <Play size={20} style={{ color: ACCENT }} fill={ACCENT} />
                </div>
              </div>
              <p className="text-sm font-bold text-white truncate w-full">{artist.name}</p>
              <p className="text-[10px] text-white/40">{artist.genre}</p>
              <p className="text-[10px]" style={{ color: ACCENT }}>{fmtNum(artist.followers)} followers</p>
              <button
                onClick={e => { e.stopPropagation(); toggleFollow(artist.id); }}
                className="mt-1 rounded-full px-3 py-1 text-xs font-bold transition-all"
                style={{
                  background: isFollowing ? 'transparent' : ACCENT,
                  color: isFollowing ? ACCENT : '#000',
                  border: `1px solid ${ACCENT}`,
                }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Artist detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="relative w-full max-w-2xl overflow-hidden rounded-t-3xl lg:rounded-3xl"
              style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh', overflowY: 'auto' }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Artist banner */}
              <div className="relative h-40 overflow-hidden">
                <img src={selected.image} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0"
                  style={{ background: `linear-gradient(to bottom, transparent 40%, ${selected.color}cc 100%)` }} />
                <button onClick={() => setSelected(null)}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <X size={16} className="text-white" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-end justify-between mb-1">
                  <h2 className="text-2xl font-black text-white">{selected.name}</h2>
                  <button
                    onClick={() => toggleFollow(selected.id)}
                    className="rounded-full px-5 py-2 text-sm font-bold transition-all"
                    style={{
                      background: followed.has(selected.id) ? 'transparent' : ACCENT,
                      color: followed.has(selected.id) ? ACCENT : '#000',
                      border: `1px solid ${ACCENT}`,
                    }}
                  >
                    {followed.has(selected.id) ? (
                      <span className="flex items-center gap-1"><CheckCircle size={14} />Following</span>
                    ) : 'Follow'}
                  </button>
                </div>
                <p className="text-sm text-white/40 mb-1">{selected.genre}</p>
                <p className="text-xs text-white/30 mb-5">
                  {fmtNum(selected.followers)} followers · {fmtNum(selected.monthlyListeners)} monthly listeners
                </p>

                <h3 className="text-base font-bold text-white mb-3">Top Tracks</h3>
                {selected.songs.length === 0 && (
                  <p className="py-6 text-center text-sm text-white/40">Loading tracks…</p>
                )}
                <div className="space-y-2">
                  {selected.songs.map((song, i) => {
                    const active = currentSong?.id === song.id;
                    const liked = likedSongs.some(s => s.id === song.id);
                    return (
                      <div key={song.id}
                        className="song-card flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                        style={{
                          background: active ? 'rgba(29,185,84,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        }}
                        onClick={() => active ? togglePlay() : playSong(song, selected.songs)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${active && isPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            active ? togglePlay() : playSong(song, selected.songs);
                          }
                        }}
                      >
                        <span className="text-xs font-bold text-white/30 w-4">{i + 1}</span>
                        <img src={song.coverUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: active ? ACCENT : '#fff' }}>{song.title}</p>
                          <p className="truncate text-xs text-white/40">{song.album}</p>
                        </div>
                        <span className="text-xs text-white/30">{fmt(song.duration)}</span>
                        <button onClick={e => { e.stopPropagation(); toggleLike(song); }}
                          style={{ color: liked ? ACCENT : 'rgba(255,255,255,0.3)' }}>
                          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="play-btn flex h-8 w-8 items-center justify-center rounded-full text-black"
                          style={{ background: ACCENT }}>
                          {active && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
