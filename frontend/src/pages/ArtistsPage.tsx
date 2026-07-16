import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Pause, Heart, X, CheckCircle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Song } from '../context/AudioContext';

const ACCENT = '#1DB954';

const AUDIO_POOL = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
];

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

const ARTISTS: Artist[] = [
  {
    id: 'a1', name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    genre: 'R&B / Pop', followers: 87420000, monthlyListeners: 92300000, color: '#8B0000',
    songs: [
      { id: 'a1s1', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300', audioUrl: AUDIO_POOL[0], duration: 200000 },
      { id: 'a1s2', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300', audioUrl: AUDIO_POOL[1], duration: 215000 },
      { id: 'a1s3', title: 'Starboy', artist: 'The Weeknd', album: 'Starboy', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300', audioUrl: AUDIO_POOL[2], duration: 230000 },
    ],
  },
  {
    id: 'a2', name: 'Dua Lipa', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    genre: 'Pop / Dance', followers: 72100000, monthlyListeners: 68900000, color: '#1a006b',
    songs: [
      { id: 'a2s1', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300', audioUrl: AUDIO_POOL[2], duration: 203000 },
      { id: 'a2s2', title: 'Don\'t Start Now', artist: 'Dua Lipa', album: 'Future Nostalgia', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300', audioUrl: AUDIO_POOL[3], duration: 183000 },
    ],
  },
  {
    id: 'a3', name: 'Ed Sheeran', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
    genre: 'Pop / Folk', followers: 91000000, monthlyListeners: 78600000, color: '#5c3d00',
    songs: [
      { id: 'a3s1', title: 'Bad Habits', artist: 'Ed Sheeran', album: '=', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300', audioUrl: AUDIO_POOL[0], duration: 231000 },
      { id: 'a3s2', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300', audioUrl: AUDIO_POOL[4], duration: 234000 },
    ],
  },
  {
    id: 'a4', name: 'Doja Cat', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
    genre: 'Pop / Hip-Hop', followers: 45200000, monthlyListeners: 51700000, color: '#6b006b',
    songs: [
      { id: 'a4s1', title: 'Kiss Me More', artist: 'Doja Cat', album: 'Planet Her', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300', audioUrl: AUDIO_POOL[1], duration: 215000 },
      { id: 'a4s2', title: 'Need to Know', artist: 'Doja Cat', album: 'Planet Her', genre: 'R&B', coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300', audioUrl: AUDIO_POOL[2], duration: 197000 },
    ],
  },
  {
    id: 'a5', name: 'Lil Nas X', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    genre: 'Hip-Hop / Pop', followers: 31800000, monthlyListeners: 29400000, color: '#00456b',
    songs: [
      { id: 'a5s1', title: 'Industry Baby', artist: 'Lil Nas X', album: 'Montero', genre: 'Hip-Hop', coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300', audioUrl: AUDIO_POOL[3], duration: 212000 },
      { id: 'a5s2', title: 'Montero', artist: 'Lil Nas X', album: 'Montero', genre: 'Pop', coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300', audioUrl: AUDIO_POOL[0], duration: 137000 },
    ],
  },
  {
    id: 'a6', name: 'Alan Walker', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400',
    genre: 'Electronic / EDM', followers: 28500000, monthlyListeners: 32100000, color: '#001a6b',
    songs: [
      { id: 'a6s1', title: 'Faded', artist: 'Alan Walker', album: 'Different World', genre: 'Electronic', coverUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300', audioUrl: AUDIO_POOL[4], duration: 212000 },
    ],
  },
];

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
    fetch('/api/artists')
      .then(res => res.ok ? res.json() : null)
      .then((data: { artists?: Artist[] } | null) => {
        if (data?.artists?.length) {
          setArtists(data.artists);
        }
      })
      .catch(() => {});
  }, []);

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
              className="group flex flex-col items-center gap-2 cursor-pointer rounded-2xl p-4 text-center transition-all duration-200"
              style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4, borderColor: 'rgba(29,185,84,0.25)' }}
              onClick={() => setSelected(artist)}
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
                <div className="space-y-2">
                  {selected.songs.map((song, i) => {
                    const active = currentSong?.id === song.id;
                    const liked = likedSongs.some(s => s.id === song.id);
                    return (
                      <div key={song.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer"
                        style={{
                          background: active ? 'rgba(29,185,84,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        }}
                        onClick={() => active ? togglePlay() : playSong(song, selected.songs)}
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
                          className="flex h-8 w-8 items-center justify-center rounded-full text-black"
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
