import type { MouseEvent } from 'react';
import { useState } from 'react';
import { useToast } from '../store/toastStore';
import {
  Play, Pause, Heart, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Shuffle,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';

const ACCENT = '#1DB954';

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const PlayerBar = () => {
  const {
    currentSong,
    isPlaying,
    duration,
    currentTime,
    volume,
    playbackRate,
    likedSongs,
    togglePlay,
    seek,
    setVolumeLevel,
    setPlaybackRate,
    prevTrack,
    nextTrack,
    toggleLike,
  } = useAudio();

  const { addToast } = useToast();
  const [muted, setMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(0.7);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLiked = currentSong ? likedSongs.some(s => s.id === currentSong.id) : false;

  if (!currentSong) return null;

  const handleToggleLike = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!currentSong) return;
    const wasLiked = likedSongs.some(s => s.id === currentSong.id);
    toggleLike(currentSong);
    addToast(wasLiked ? `Removed from Liked` : `Added to Liked`, wasLiked ? 'info' : 'success');
  };

  const handleMute = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (muted) {
      setVolumeLevel(prevVol);
      setMuted(false);
    } else {
      setPrevVol(volume);
      setVolumeLevel(0);
      setMuted(true);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-3 lg:px-6"
      style={{
        background: 'rgba(18,18,18,0.96)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(29,185,84,0.12)',
        minHeight: '80px',
      }}
      role="region"
      aria-label="Now playing"
    >
      {/* ── Track info ── */}
      <div className="flex min-w-0 items-center gap-3 w-[30%]">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
          <img
            src={currentSong.coverUrl}
            alt={currentSong.title}
            className="h-full w-full object-cover"
          />
          {isPlaying && (
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full"
              style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{currentSong.title}</p>
          <p className="truncate text-xs text-white/50">{currentSong.artist}</p>
        </div>
        <button
          onClick={handleToggleLike}
          className="ml-2 flex-shrink-0 transition-all duration-200 hover:scale-110"
          style={{ color: isLiked ? ACCENT : 'rgba(255,255,255,0.4)' }}
          aria-label="Toggle like"
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* ── Controls + seek ── */}
      <div className="flex flex-1 flex-col items-center gap-2 max-w-[40%]">
        {/* Buttons */}
        <div className="flex items-center gap-4">
          <button
            className="hidden text-white/40 transition hover:text-white sm:block"
            aria-label="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); prevTrack(); }}
            className="text-white/70 transition hover:text-white hover:scale-110"
            aria-label="Previous"
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-black transition hover:scale-105 active:scale-95"
            style={{ background: ACCENT, boxShadow: `0 0 20px rgba(29,185,84,0.4)` }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextTrack(); }}
            className="text-white/70 transition hover:text-white hover:scale-110"
            aria-label="Next"
          >
            <SkipForward size={20} />
          </button>
          <button
            className="hidden text-white/40 transition hover:text-white sm:block"
            aria-label="Repeat"
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* Seek bar */}
        <div className="flex w-full items-center gap-2">
          <span className="w-10 text-right text-[11px] text-white/40">{fmt(currentTime)}</span>
          <div
            className="relative h-1 flex-1 cursor-pointer rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(ratio * duration);
            }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: ACCENT }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity hover:opacity-100"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <span className="w-10 text-[11px] text-white/40">{fmt(duration)}</span>
        </div>
      </div>

      {/* ── Volume + speed ── */}
      <div className="hidden w-[25%] items-center justify-end gap-3 lg:flex">
        {/* Speed */}
        <div className="flex items-center gap-1">
          {[0.5, 1, 1.5, 2].map(rate => (
            <button
              key={rate}
              onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); }}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold transition"
              style={{
                background: playbackRate === rate ? 'rgba(29,185,84,0.2)' : 'transparent',
                color: playbackRate === rate ? ACCENT : 'rgba(255,255,255,0.35)',
                border: `1px solid ${playbackRate === rate ? 'rgba(29,185,84,0.4)' : 'transparent'}`,
              }}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <button onClick={handleMute} className="text-white/50 transition hover:text-white">
          {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <div
          className="relative h-1 w-24 cursor-pointer rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)' }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setVolumeLevel(v);
            setMuted(false);
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${(muted ? 0 : volume) * 100}%`, background: ACCENT }}
          />
        </div>
      </div>
    </div>
  );
};