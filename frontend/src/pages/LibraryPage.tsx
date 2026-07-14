import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Heart, Clock, Music2, Plus, X, Trash2, Pencil, Shuffle, ChevronDown } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useToast } from '../store/toastStore';

const ACCENT = '#1DB954';

type Tab = 'liked' | 'recents' | 'playlists';

const PLAYLIST_GRADIENTS = [
  'linear-gradient(135deg,#1DB954,#158a3e)',
  'linear-gradient(135deg,#F59E0B,#B45309)',
  'linear-gradient(135deg,#8B5CF6,#5B21B6)',
  'linear-gradient(135deg,#06B6D4,#0E7490)',
  'linear-gradient(135deg,#EF4444,#991B1B)',
  'linear-gradient(135deg,#EC4899,#9D174D)',
];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function LibraryPage() {
  const {
    likedSongs, recentPlays, playlists,
    playSong, toggleLike, togglePlay, currentSong, isPlaying,
    removeSongFromPlaylist, renamePlaylist, deletePlaylist, playPlaylist, createPlaylist,
  } = useAudio();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('liked');
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const list = tab === 'liked' ? likedSongs : recentPlays;
  const emptyMsg = tab === 'liked'
    ? 'Like songs to save them here'
    : 'Songs you play will show up here';

  const openPlaylist = playlists.find(p => p.id === openPlaylistId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createPlaylist(newName.trim());
    addToast(`Playlist "${newName.trim()}" created`, 'success');
    setNewName('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renamePlaylist(id, editName.trim());
    setEditingId(null);
    addToast('Playlist renamed', 'success');
  };

  const TABS = [
    { key: 'liked' as Tab, label: 'Liked Songs', icon: Heart, count: likedSongs.length },
    { key: 'recents' as Tab, label: 'Recent Plays', icon: Clock, count: recentPlays.length },
    { key: 'playlists' as Tab, label: 'Playlists', icon: Music2, count: playlists.length },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Your Library</h2>
          <p className="text-sm mt-1 text-white/40">
            {likedSongs.length} liked · {recentPlays.length} recent · {playlists.length} playlists
          </p>
        </div>
        {tab === 'playlists' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-black transition hover:scale-105"
            style={{ background: ACCENT }}
          >
            <Plus size={15} /> New Playlist
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={{
              background: tab === key ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.05)',
              color: tab === key ? ACCENT : 'rgba(255,255,255,0.5)',
              border: `1px solid ${tab === key ? 'rgba(29,185,84,0.35)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <Icon size={14} />
            {label}
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-mono"
              style={{ background: tab === key ? 'rgba(29,185,84,0.2)' : 'rgba(255,255,255,0.08)', minWidth: '18px', textAlign: 'center' }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {/* Liked / Recents */}
          {tab !== 'playlists' && (
            list.length > 0 ? (
              <div className="space-y-1.5">
                {list.map((song, i) => {
                  const active = currentSong?.id === song.id;
                  const liked = likedSongs.some(s => s.id === song.id);
                  return (
                    <motion.div
                      key={song.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all"
                      style={{
                        background: active ? 'rgba(29,185,84,0.08)' : 'rgba(40,40,40,0.5)',
                        border: `1px solid ${active ? 'rgba(29,185,84,0.25)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => active ? togglePlay() : playSong(song, list)}
                    >
                      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg">
                        <img src={song.coverUrl} alt="" className="h-full w-full object-cover" />
                        {active && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center gap-0.5"
                            style={{ background: 'rgba(0,0,0,0.6)' }}>
                            {[...Array(3)].map((_, j) => (
                              <div key={j} className="w-0.5 rounded-full animate-bounce"
                                style={{ height: `${5 + j * 3}px`, background: ACCENT, animationDelay: `${j * 0.1}s` }} />
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
                        style={{ color: liked ? ACCENT : 'rgba(255,255,255,0.25)' }}
                        className="transition hover:scale-110"
                      >
                        <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); active ? togglePlay() : playSong(song, list); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-black transition hover:scale-105"
                        style={{ background: ACCENT }}
                      >
                        {active && isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message={emptyMsg} />
            )
          )}

          {/* Playlists tab */}
          {tab === 'playlists' && (
            <div className="space-y-6">
              {playlists.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  <div className="h-16 w-16 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.15)' }}>
                    <Music2 size={24} style={{ color: 'rgba(29,185,84,0.5)' }} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white mb-1">No playlists yet</p>
                    <p className="text-sm text-white/40">Create a playlist to organise your music</p>
                  </div>
                  <button onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-black"
                    style={{ background: ACCENT }}>
                    <Plus size={15} /> Create Playlist
                  </button>
                </div>
              ) : (
                <>
                  {/* Playlist grid */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {playlists.map((pl, i) => (
                      <motion.div
                        key={pl.id}
                        className="group cursor-pointer rounded-2xl p-3 transition-all duration-200"
                        style={{ background: '#181818', border: `1px solid ${openPlaylistId === pl.id ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -3 }}
                        onClick={() => setOpenPlaylistId(openPlaylistId === pl.id ? null : pl.id)}
                      >
                        <div className="relative mb-3 aspect-square overflow-hidden rounded-xl flex items-center justify-center"
                          style={{ background: PLAYLIST_GRADIENTS[i % PLAYLIST_GRADIENTS.length] }}>
                          <Music2 size={32} color="rgba(255,255,255,0.4)" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(0,0,0,0.4)' }}>
                            <Play size={22} fill="white" color="white" />
                          </div>
                        </div>
                        {editingId === pl.id ? (
                          <div onClick={e => e.stopPropagation()} className="flex gap-1">
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              className="flex-1 rounded-lg px-2 py-1 text-xs text-white outline-none min-w-0"
                              style={{ background: '#282828', border: `1px solid ${ACCENT}` }}
                              onKeyDown={e => e.key === 'Enter' && handleRename(pl.id)}
                              autoFocus />
                            <button onClick={() => handleRename(pl.id)}
                              className="rounded-lg px-2 text-[10px] font-bold text-black"
                              style={{ background: ACCENT }}>✓</button>
                          </div>
                        ) : (
                          <p className="truncate text-sm font-semibold text-white leading-tight">{pl.name}</p>
                        )}
                        <p className="text-xs text-white/40 mt-0.5">{pl.songs.length} tracks</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Open playlist detail */}
                  <AnimatePresence>
                    {openPlaylist && (
                      <motion.div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
                          <h3 className="text-base font-bold text-white">{openPlaylist.name}</h3>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { playPlaylist(openPlaylist.id); addToast('Playing playlist', 'info'); }}
                              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-black"
                              style={{ background: ACCENT }}>
                              <Play size={12} fill="currentColor" /> Play
                            </button>
                            <button onClick={() => { playPlaylist(openPlaylist.id, true); addToast('Shuffling playlist', 'info'); }}
                              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                              <Shuffle size={12} /> Shuffle
                            </button>
                            <button onClick={() => { setEditingId(openPlaylist.id); setEditName(openPlaylist.name); }}
                              className="rounded-lg p-1.5"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => {
                              deletePlaylist(openPlaylist.id);
                              setOpenPlaylistId(null);
                              addToast('Playlist deleted', 'info');
                            }} className="rounded-lg p-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                              <Trash2 size={13} />
                            </button>
                            <button onClick={() => setOpenPlaylistId(null)}
                              className="rounded-lg p-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              <ChevronDown size={15} />
                            </button>
                          </div>
                        </div>

                        {openPlaylist.songs.length === 0 ? (
                          <div className="py-12 text-center text-white/30 text-sm">
                            No songs yet. Add songs from the player.
                          </div>
                        ) : (
                          <div className="divide-y divide-white/[0.04] px-2 py-2">
                            {openPlaylist.songs.map((song, i) => {
                              const active = currentSong?.id === song.id;
                              return (
                                <div key={song.id}
                                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all"
                                  style={{ background: active ? 'rgba(29,185,84,0.06)' : 'transparent' }}
                                  onClick={() => active ? togglePlay() : playSong(song, openPlaylist.songs)}
                                >
                                  <span className="text-xs text-white/25 w-4">{i + 1}</span>
                                  <img src={song.coverUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-semibold" style={{ color: active ? ACCENT : '#fff' }}>{song.title}</p>
                                    <p className="truncate text-xs text-white/40">{song.artist}</p>
                                  </div>
                                  <span className="hidden text-xs text-white/25 sm:block">{fmt(song.duration)}</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      removeSongFromPlaylist(openPlaylist.id, song.id);
                                      addToast('Removed from playlist', 'info');
                                    }}
                                    className="rounded-lg p-1 transition hover:text-red-400 text-white/25"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Create Playlist Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#282828', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-white mb-4">Create Playlist</h3>
              <div className="space-y-3">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Playlist name"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  style={{ background: '#181818', border: `1px solid ${newName ? ACCENT : 'rgba(255,255,255,0.1)'}` }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-full py-2.5 text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                  Cancel
                </button>
                <button onClick={handleCreate}
                  className="flex-1 rounded-full py-2.5 text-sm font-bold text-black"
                  style={{ background: newName.trim() ? ACCENT : 'rgba(29,185,84,0.3)', cursor: newName.trim() ? 'pointer' : 'default' }}>
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <div className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.15)' }}>
        <Music2 size={22} style={{ color: 'rgba(29,185,84,0.5)' }} />
      </div>
      <div>
        <p className="text-base font-semibold text-white mb-1">Nothing here yet</p>
        <p className="text-sm text-white/40">{message}</p>
      </div>
    </div>
  );
}
