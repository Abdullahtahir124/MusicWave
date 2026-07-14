import React, { useReducer, useRef, useEffect, useState, useCallback } from 'react';
import {
  PlayerContext, playerReducer, initialPlayerState,
  type PlayerState,
} from './playerStore';

const FALLBACK = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const acRef      = useRef<AudioContext | null>(null);
  const gainRef    = useRef<GainNode | null>(null);
  const sourceRef  = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef= useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stateRef   = useRef<PlayerState>(state);

  // Keep ref in sync so audio event handlers are never stale
  useEffect(() => { stateRef.current = state; }, [state]);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      dispatch({ type: 'SET_TIME', time: audio.currentTime });
    });
    audio.addEventListener('durationchange', () => {
      dispatch({ type: 'SET_DURATION', duration: isFinite(audio.duration) ? audio.duration : 0 });
    });
    audio.addEventListener('ended', () => {
      const s = stateRef.current;
      if (s.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        dispatch({ type: 'NEXT' });
      }
    });
    audio.addEventListener('error', () => {
      dispatch({ type: 'SET_PLAYING', value: false });
    });

    return () => { audio.pause(); };
  }, []);

  // Init Web Audio lazily
  const initAudio = useCallback(() => {
    if (acRef.current || !audioRef.current) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      acRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = stateRef.current.volume;
      gainRef.current = gain;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      analyserRef.current = an;
      const src = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = src;
      src.connect(an);
      an.connect(gain);
      gain.connect(ctx.destination);
      setAnalyser(an);
    } catch {}
  }, []);

  // Sync audio src + play/pause when currentSong or isPlaying changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.currentSong) {
      const url = state.currentSong.audioUrl ?? FALLBACK;
      if (audio.src !== url && !audio.src.endsWith(url)) {
        audio.src = url;
        audio.load();
      }
      if (state.isPlaying) {
        if (acRef.current?.state === 'suspended') acRef.current.resume();
        audio.play().catch(() => dispatch({ type: 'SET_PLAYING', value: false }));
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
    }
  }, [state.currentSong?.id, state.isPlaying]);

  // Volume / mute
  useEffect(() => {
    if (!gainRef.current) return;
    gainRef.current.gain.value = state.isMuted ? 0 : state.volume;
  }, [state.volume, state.isMuted]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    dispatch({ type: 'SET_TIME', time });
  }, []);

  const wrappedDispatch: React.Dispatch<any> = useCallback((action: any) => {
    if (action.type === 'PLAY_SONG' || action.type === 'TOGGLE_PLAY') {
      initAudio();
    }
    dispatch(action);
  }, [initAudio]);

  return (
    <PlayerContext.Provider value={{ state, dispatch: wrappedDispatch, seek, audioRef, analyser }}>
      {children}
    </PlayerContext.Provider>
  );
}
