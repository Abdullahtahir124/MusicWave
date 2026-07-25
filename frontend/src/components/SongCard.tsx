import { Pause, Play, Heart } from 'lucide-react';
import type { Song } from '../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#1DB954', bg: 'rgba(29,185,84,0.12)' },
  preview: { label: 'Sample', color: '#D29922', bg: 'rgba(210,153,34,0.12)' },
  unavailable: { label: 'Unavailable', color: '#F85149', bg: 'rgba(248,81,73,0.12)' },
};

interface SongCardProps {
  song: Song;
  isActive?: boolean;
  isPlaying?: boolean;
  isLiked?: boolean;
  onPlay: () => void;
  onLike?: () => void;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SongCard({ song, isActive = false, isPlaying = false, isLiked = false, onPlay, onLike }: SongCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay();
    }
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer song-card"
      style={{
        background: isActive ? 'rgba(29,185,84,0.08)' : 'rgba(40,40,40,0.6)',
        borderColor: isActive ? 'rgba(29,185,84,0.4)' : 'rgba(255,255,255,0.08)',
        boxShadow: isActive ? '0 0 20px rgba(29,185,84,0.15)' : 'none',
      }}
      onClick={onPlay}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isActive && isPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist}`}
    >
      {/* Cover art */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={song.coverUrl}
          alt={`${song.title} cover`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400';
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="play-btn absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100"
          style={{
            background: song.playbackStatus === 'unavailable' ? 'rgba(255,255,255,0.15)' : '#1DB954',
            boxShadow: song.playbackStatus === 'unavailable' ? 'none' : '0 4px 20px rgba(29,185,84,0.5)',
            opacity: isActive ? 1 : undefined,
            cursor: song.playbackStatus === 'unavailable' ? 'not-allowed' : 'pointer',
          }}
          aria-label={song.playbackStatus === 'unavailable' ? 'Track not available' : isActive && isPlaying ? 'Pause' : 'Play'}
          disabled={song.playbackStatus === 'unavailable'}
        >
          {isActive && isPlaying
            ? <Pause size={18} fill="white" />
            : <Play size={18} fill="white" className="ml-0.5" />
          }
        </button>

        {/* Active indicator */}
        {isActive && isPlaying && (
          <div className="absolute top-3 left-3 flex items-center gap-0.5">
            {[1,2,3,4].map(b => (
              <span
                key={b}
                className="inline-block w-[3px] rounded-full"
                style={{
                  height: `${8 + (b * 3)}px`,
                  background: '#1DB954',
                  animation: `eq${b} ${0.7 + b * 0.1}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p
                className="truncate text-sm font-bold leading-tight"
                style={{ color: isActive ? '#1DB954' : '#fff' }}
              >
                {song.title}
              </p>
              {song.playbackStatus && STATUS_CONFIG[song.playbackStatus] && (
                <span
                  className="hidden flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold sm:inline-flex"
                  style={{ color: STATUS_CONFIG[song.playbackStatus].color, background: STATUS_CONFIG[song.playbackStatus].bg }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_CONFIG[song.playbackStatus].color }} />
                  {STATUS_CONFIG[song.playbackStatus].label}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {song.artist}
            </p>
          </div>
          {onLike && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLike(); }}
              className="shrink-0 transition-transform hover:scale-110 active:scale-95"
              aria-label="Like song"
            >
              <Heart
                size={14}
                fill={isLiked ? '#1DB954' : 'none'}
                color={isLiked ? '#1DB954' : 'rgba(255,255,255,0.4)'}
              />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          {song.album && (
            <p className="truncate text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {song.album}
            </p>
          )}
          <span
            className="shrink-0 ml-auto text-[10px] font-mono rounded-full px-2 py-0.5"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            {formatDuration(song.duration)}
          </span>
        </div>

        {song.genre && (
          <span
            className="mt-1 self-start rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ background: 'rgba(29,185,84,0.1)', color: '#1DB954', border: '1px solid rgba(29,185,84,0.2)' }}
          >
            {song.genre}
          </span>
        )}
      </div>
    </div>
  );
}
