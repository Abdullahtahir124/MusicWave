import { createContext, useContext } from 'react';
import type { Song } from '../types';

// ── Player state (shared via Context + useReducer) ────────────────────────────

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;   // seconds
  duration: number;      // seconds
  volume: number;        // 0-1
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'none' | 'one' | 'all';
  liked: Set<string>;
}

export type PlayerAction =
  | { type: 'PLAY_SONG'; song: Song; queue?: Song[] }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_TIME'; time: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'CYCLE_REPEAT' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'TOGGLE_LIKE'; id: string }
  | { type: 'SET_PLAYING'; value: boolean };

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY_SONG': {
      const queue = action.queue ?? (action.song ? [action.song] : state.queue);
      const idx   = queue.findIndex(s => s.id === action.song.id);
      return { ...state, currentSong: action.song, queue, queueIndex: Math.max(0, idx), isPlaying: true, currentTime: 0 };
    }
    case 'TOGGLE_PLAY': return { ...state, isPlaying: !state.isPlaying };
    case 'SET_PLAYING': return { ...state, isPlaying: action.value };
    case 'SET_TIME':    return { ...state, currentTime: action.time };
    case 'SET_DURATION':return { ...state, duration: action.duration };
    case 'SET_VOLUME':  return { ...state, volume: action.volume, isMuted: false };
    case 'TOGGLE_MUTE': return { ...state, isMuted: !state.isMuted };
    case 'TOGGLE_SHUFFLE': return { ...state, isShuffle: !state.isShuffle };
    case 'CYCLE_REPEAT': {
      const modes: Array<PlayerState['repeatMode']> = ['none','one','all'];
      const next = modes[(modes.indexOf(state.repeatMode) + 1) % 3];
      return { ...state, repeatMode: next };
    }
    case 'NEXT': {
      if (!state.queue.length) return state;
      let next: number;
      if (state.isShuffle) {
        next = Math.floor(Math.random() * state.queue.length);
      } else {
        next = state.repeatMode === 'all'
          ? (state.queueIndex + 1) % state.queue.length
          : Math.min(state.queueIndex + 1, state.queue.length - 1);
      }
      return { ...state, queueIndex: next, currentSong: state.queue[next], currentTime: 0, isPlaying: true };
    }
    case 'PREV': {
      if (!state.queue.length) return state;
      // If > 3s in, restart current track
      if (state.currentTime > 3) return { ...state, currentTime: 0 };
      const prev = Math.max(state.queueIndex - 1, 0);
      return { ...state, queueIndex: prev, currentSong: state.queue[prev], currentTime: 0, isPlaying: true };
    }
    case 'TOGGLE_LIKE': {
      const liked = new Set(state.liked);
      liked.has(action.id) ? liked.delete(action.id) : liked.add(action.id);
      return { ...state, liked };
    }
    default: return state;
  }
}

export const initialPlayerState: PlayerState = {
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'none',
  liked: new Set(),
};

// ── Context ───────────────────────────────────────────────────────────────────

export interface PlayerContextType {
  state: PlayerState;
  dispatch: React.Dispatch<PlayerAction>;
  seek: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  analyser: AnalyserNode | null;
}

export const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
