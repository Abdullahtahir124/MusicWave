import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useToast } from '../store/toastStore';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  coverUrl: string;
  audioUrl: string | null;
  duration: number;
  previewAvailable?: boolean;
  isPreview?: boolean;
  matchScore?: number;
}

export interface PlayEvent {
  songId: string;
  title: string;
  genre: string;
  timestamp: string; // ISO String
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

interface AudioContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  playbackRate: number;
  analyser: AnalyserNode | null;
  likedSongs: Song[];
  recentPlays: Song[];
  playHistory: PlayEvent[];
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolumeLevel: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLike: (song: Song) => void;
  playlists: Playlist[];
  createPlaylist: (name: string) => Playlist;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  playPlaylist: (playlistId: string, shuffle?: boolean) => void;
  shufflePlaylist: (playlistId: string) => void;
  audioDebug: {
    src: string | null;
    readyState: number | null;
    networkState: number | null;
    errorCode: number | null;
    errorMessage: string | null;
    volume: number;
  };
}

const AudioCtx = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [audioDebug, setAudioDebug] = useState({
    src: null as string | null,
    readyState: null as number | null,
    networkState: null as number | null,
    errorCode: null as number | null,
    errorMessage: null as string | null,
    volume: 1,
  });
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [trackQueue, setTrackQueue] = useState<Song[]>([]);

  // User list state
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [recentPlays, setRecentPlays] = useState<Song[]>([]);
  const [playHistory, setPlayHistory] = useState<PlayEvent[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const raw = localStorage.getItem('musify_playlists');
      return raw ? JSON.parse(raw) as Playlist[] : [];
    } catch {
      return [];
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addToast, removeToast } = useToast();
  const loadingToastRef = useRef<string | null>(null);
  const lastPlayRef = useRef<number>(0);
  const pendingPlayRef = useRef<number | null>(null);
  const playRequestIdRef = useRef<number>(0);

  useEffect(() => {
    // Create HTML Audio element
    const audio = new Audio();
    // Bypassing Web Audio Context source node connection to ensure cross-origin (CORS) streams play correctly.
    audio.crossOrigin = 'anonymous';
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    // Expose a debug helper to the window so the user can inspect audio state from DevTools
    try {
      (window as any).__audioDebug = () => ({
        currentSong: (() => currentSong)(),
        isPlaying: (() => isPlaying)(),
        audioSrc: audioRef.current?.src,
        readyState: audioRef.current?.readyState,
        lastPlayAt: lastPlayRef.current,
        playRequestId: (playRequestIdRef as any)?.current ?? null,
        playSongCalls: (window as any).__playSongCalls ?? 0,
      });
    } catch {}

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const updateDebug = () => {
      if (!audioRef.current) return;
      const a = audioRef.current;
      setAudioDebug({
        src: a.src || null,
        readyState: a.readyState ?? null,
        networkState: a.networkState ?? null,
        errorCode: a.error ? (a.error.code ?? null) : null,
        errorMessage: a.error ? (a.error.message ?? null) : null,
        volume: a.volume,
      });
    };
    
    const handleDurationChange = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration || 0);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      nextTrack();
    };

    const handleError = (ev: Event) => {
      // eslint-disable-next-line no-console
      console.error('Audio element error', ev, audioRef.current?.src);
      try { addToast('Audio playback error', 'error'); } catch {}
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', updateDebug);
    audio.addEventListener('loadedmetadata', updateDebug);
    audio.addEventListener('volumechange', updateDebug);
    audio.addEventListener('playing', updateDebug);
    audio.addEventListener('pause', updateDebug);
    // populate initial debug state
    updateDebug();

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', updateDebug);
      audio.removeEventListener('loadedmetadata', updateDebug);
      audio.removeEventListener('volumechange', updateDebug);
      audio.removeEventListener('playing', updateDebug);
      audio.removeEventListener('pause', updateDebug);
      audio.pause();
    };
  }, []);

  const playSong = (song: Song, queue: Song[] = []) => {
    try { console.log('playSong called', { id: song.id, title: song.title, audioUrl: song.audioUrl }); } catch {}
    try {
      // expose a global counter for debugging in the browser console
      (window as any).__lastPlayCall = { id: song.id, title: song.title, audioUrl: song.audioUrl, ts: Date.now() };
      (window as any).__playSongCalls = ((window as any).__playSongCalls || 0) + 1;
    } catch {}
    if (queue.length > 0) {
      setTrackQueue(queue);
    } else if (trackQueue.length === 0 || !trackQueue.find(s => s.id === song.id)) {
      setTrackQueue([song]);
    }

    setCurrentSong(song);
    try {
      if (!loadingToastRef.current) {
        loadingToastRef.current = addToast(`Loading ${song.title}`, 'info');
      }
    } catch {}

    // Track play stats & recents
    setRecentPlays((prev) => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 10);
    });

    setPlayHistory((prev) => [
      ...prev,
      {
        songId: song.id,
        title: song.title,
        genre: song.genre || "Pop",
        timestamp: new Date().toISOString()
      }
    ]);
    
    // debounce/queue rapid playSong calls to prevent interrupted play() promises
    const now = Date.now();
    if (now - lastPlayRef.current < 260) {
      if (pendingPlayRef.current) clearTimeout(pendingPlayRef.current);
      pendingPlayRef.current = window.setTimeout(() => {
        pendingPlayRef.current = null;
        // schedule a new play request id for the scheduled call
        playRequestIdRef.current += 1;
        playSong(song, queue);
      }, 260);
      try { console.log('playSong debounced, scheduling'); } catch {}
      return;
    }

    // assign a unique request id for this play attempt
    playRequestIdRef.current += 1;
    const reqId = playRequestIdRef.current;

    if (audioRef.current) {
      if (!song.audioUrl) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        setIsPlaying(false);
        setDuration(Math.max(0, song.duration / 1000));
        setCurrentTime(0);
        try { addToast('No audio available for this track', 'error'); } catch {}
        return;
      }

      const existingSrc = audioRef.current.src || '';
      if (existingSrc === song.audioUrl) {
        try { console.log('playSong: same src, calling play only'); } catch {}
        // only call play if this request is still the latest
        if (playRequestIdRef.current !== reqId) {
          try { console.log('playSong: aborting because a newer request exists'); } catch {}
          return;
        }
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(err => {
              // eslint-disable-next-line no-console
              console.error('Playback failed:', err, 'src=', audioRef.current?.src);
              try {
                if (loadingToastRef.current) { removeToast(loadingToastRef.current); loadingToastRef.current = null; }
                addToast(`Playback failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
              } catch {}
              setIsPlaying(false);
            });
        }
        return;
      }

      audioRef.current.src = song.audioUrl;
      audioRef.current.volume = volume;
      audioRef.current.autoplay = true;
      audioRef.current.playbackRate = playbackRate;

      try {
        // eslint-disable-next-line no-console
        console.log('Attempting playback immediately', { src: audioRef.current.src, readyState: audioRef.current.readyState });
      } catch {}

      const playAttempt = () => {
        if (!audioRef.current) return;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => {
            setIsPlaying(true);
            lastPlayRef.current = Date.now();
            try {
              if (loadingToastRef.current) {
                removeToast(loadingToastRef.current);
                loadingToastRef.current = null;
              }
              addToast(`Now playing: ${song.title}`, 'success');
            } catch {}
          }).catch(err => {
            // eslint-disable-next-line no-console
            console.error('Playback failed on initial play:', err, 'src=', audioRef.current?.src);
            try {
              if (loadingToastRef.current) {
                removeToast(loadingToastRef.current);
                loadingToastRef.current = null;
              }
              addToast(`Playback failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
            } catch {}
            setIsPlaying(false);
          });
        }
      };

      let proxied = false;
      const handleNetworkError = () => {
        if (proxied) return;
        proxied = true;
        try { console.warn('Audio element error detected, retrying via backend proxy'); } catch {}
        if (!audioRef.current) return;
        audioRef.current.removeEventListener('error', handleNetworkError);
        audioRef.current.src = `/api/proxy?url=${encodeURIComponent(song.audioUrl || '')}`;
        playAttempt();
      };

      audioRef.current.addEventListener('error', handleNetworkError, { once: true });
      playAttempt();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    try { console.log('togglePlay called', { isPlaying, src: audioRef.current?.src }); } catch {}
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(err => {
            // eslint-disable-next-line no-console
            console.error('Playback failed:', err, 'src=', audioRef.current?.src);
            try { addToast(`Playback failed: ${err instanceof Error ? err.message : String(err)}`, 'error'); } catch {}
            setIsPlaying(false);
          });
      }
    }
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const setVolumeLevel = (val: number) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const nextTrack = () => {
    if (trackQueue.length === 0 || !currentSong) return;
    const currentIndex = trackQueue.findIndex(s => s.id === currentSong.id);
    if (currentIndex !== -1 && currentIndex < trackQueue.length - 1) {
      playSong(trackQueue[currentIndex + 1], trackQueue);
    }
  };

  const prevTrack = () => {
    if (trackQueue.length === 0 || !currentSong) return;
    const currentIndex = trackQueue.findIndex(s => s.id === currentSong.id);
    if (currentIndex > 0) {
      playSong(trackQueue[currentIndex - 1], trackQueue);
    }
  };

  const toggleLike = (song: Song) => {
    setLikedSongs((prev) => {
      const isLiked = prev.some(s => s.id === song.id);
      if (isLiked) {
        return prev.filter(s => s.id !== song.id);
      } else {
        return [...prev, song];
      }
    });
  };

  // Playlists
  const persistPlaylists = (next: Playlist[]) => {
    try { localStorage.setItem('musify_playlists', JSON.stringify(next)); } catch {}
  };

  const createPlaylist = (name: string) => {
    const p: Playlist = { id: crypto.randomUUID(), name: name || 'Untitled', songs: [] };
    setPlaylists(prev => { const next = [p, ...prev]; persistPlaylists(next); return next; });
    return p;
  };

  const addSongToPlaylist = (playlistId: string, song: Song) => {
    setPlaylists(prev => {
      const next = prev.map(pl => {
        if (pl.id !== playlistId) return pl;
        if (pl.songs.some(s => s.id === song.id)) return pl;
        return { ...pl, songs: [song, ...pl.songs] };
      });
      persistPlaylists(next);
      return next;
    });
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists(prev => {
      const next = prev.map(pl => pl.id === playlistId ? { ...pl, songs: pl.songs.filter(s => s.id !== songId) } : pl);
      persistPlaylists(next);
      return next;
    });
  };

  const renamePlaylist = (playlistId: string, name: string) => {
    setPlaylists(prev => {
      const next = prev.map(pl => pl.id === playlistId ? { ...pl, name } : pl);
      persistPlaylists(next);
      return next;
    });
  };

  const deletePlaylist = (playlistId: string) => {
    setPlaylists(prev => {
      const next = prev.filter(pl => pl.id !== playlistId);
      persistPlaylists(next);
      return next;
    });
  };

  const playPlaylist = (playlistId: string, shuffle = false) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || pl.songs.length === 0) return;
    const queue = shuffle ? [...pl.songs].sort(() => Math.random() - 0.5) : pl.songs;
    setTrackQueue(queue);
    playSong(queue[0], queue);
  };

  const shufflePlaylist = (playlistId: string) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const shuffled = [...pl.songs].sort(() => Math.random() - 0.5);
    setPlaylists(prev => {
      const next = prev.map(p => p.id === playlistId ? { ...p, songs: shuffled } : p);
      persistPlaylists(next);
      return next;
    });
  };

  return (
    <AudioCtx.Provider value={{
      currentSong, isPlaying, duration, currentTime, volume, playbackRate,
      analyser: null, likedSongs, recentPlays, playHistory,
      playSong, togglePlay, seek, setVolumeLevel, setPlaybackRate, nextTrack, prevTrack, toggleLike,
      playlists, createPlaylist, addSongToPlaylist,
      removeSongFromPlaylist, renamePlaylist, deletePlaylist, playPlaylist, shufflePlaylist,
      audioDebug,
    }}>
      {children}
    </AudioCtx.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioCtx);
  if (!context) throw new Error("useAudio must be used within AudioProvider");
  return context;
};
