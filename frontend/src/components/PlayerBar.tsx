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

// Spotify's Track IDs are 22-character base62 strings (e.g. "0VjIjW4GlUZAMYd2vXMi3b").
// Local/mock fallback songs (e.g. "static-1") are NOT valid Spotify IDs and can't be embedded.
function isValidSpotifyId(id: string) {
  return /^[A-Za-z0-9]{22}$/.test(id);
}

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

  const { addToast, removeToast } = useToast();
  const loadingToastRef = useRef<string | null>(null);

  // Spotify IFrame API controller ref
  const controllerRef = useRef<any>(null);
  const apiReadyRef = useRef(false);
  const pendingUriRef = useRef<string | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  currentSongRef.current = currentSong;

  useEffect(() => {
    // Load the Spotify IFrame API script if it's not already on the page
    if (!document.getElementById('spotify-iframe-api-script')) {
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api-script';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);
    }

    (window as any).onSpotifyIframeApiReady = (IFrameAPI: any) => {
      const element = document.getElementById('spotify-embed');
      if (!element) return;

      const options = { uri: '', width: '1', height: '1' };
      const callback = (EmbedController: any) => {
        controllerRef.current = EmbedController;
        apiReadyRef.current = true;

        EmbedController.addListener('playback_update', (e: any) => {
          const data = e?.data ?? {};
          if (typeof data.position === 'number') setCurrentTime(data.position / 1000);
          if (typeof data.duration === 'number') setDuration(data.duration / 1000);
          if (typeof data.isPaused === 'boolean') setIsPlaying(!data.isPaused);

          if (data.isPaused && data.position === 0 && data.duration > 0 && currentSongRef.current) {
            // Track likely ended — advance queue
            nextTrackRef.current();
          }
        });

        EmbedController.addListener('ready', () => {
          if (pendingUriRef.current) {
            EmbedController.loadUri(pendingUriRef.current);
            EmbedController.play();
            pendingUriRef.current = null;
          }
        });
      };

      IFrameAPI.createController(element, options, callback);
    };

    return () => {
      (window as any).onSpotifyIframeApiReady = undefined;
    };
  }, []);

  // Keep a ref to nextTrack so the playback_update listener (created once) always calls the latest version
  const nextTrackRef = useRef<() => void>(() => { });

  const playSong = (song: Song, queue: Song[] = []) => {
    if (queue.length > 0) {
      setTrackQueue(queue);
    } else if (trackQueue.length === 0 || !trackQueue.find(s => s.id === song.id)) {
      setTrackQueue([song]);
    }

    setCurrentSong(song);

    setRecentPlays((prev) => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 10);
    });

    setPlayHistory((prev) => [
      ...prev,
      {
        songId: song.id,
        title: song.title,
        genre: song.genre || 'Pop',
        timestamp: new Date().toISOString(),
      },
    ]);

    if (!isValidSpotifyId(song.id)) {
      setIsPlaying(false);
      try { addToast('This track has no Spotify ID available for playback', 'error'); } catch { }
      return;
    }

    const uri = `spotify:track:${song.id}`;

    try {
      if (!loadingToastRef.current) {
        loadingToastRef.current = addToast(`Loading ${song.title}`, 'info');
      }
    } catch { }

    if (controllerRef.current && apiReadyRef.current) {
      controllerRef.current.loadUri(uri);
      controllerRef.current.play();
      try {
        if (loadingToastRef.current) { removeToast(loadingToastRef.current); loadingToastRef.current = null; }
        addToast(`Now playing: ${song.title}`, 'success');
      } catch { }
    } else {
      // Controller not ready yet — queue it up, the 'ready' listener will pick it up
      pendingUriRef.current = uri;
    }
  };

  const togglePlay = () => {
    if (!controllerRef.current) return;
    controllerRef.current.togglePlay();
  };

  const seek = (time: number) => {
    if (!controllerRef.current) return;
    controllerRef.current.seek(time);
    setCurrentTime(time);
  };

  const setVolumeLevel = (val: number) => {
    // Spotify's embedded widget manages its own audio volume internally and
    // does not expose a volume-control method via the IFrame API.
    setVolume(val);
  };

  const setPlaybackRate = (_rate: number) => {
    // Not supported by the Spotify embed — playback speed is fixed at 1x.
    setPlaybackRateState(1);
  };

  const nextTrack = () => {
    if (trackQueue.length === 0 || !currentSong) return;
    const currentIndex = trackQueue.findIndex(s => s.id === currentSong.id);
    if (currentIndex !== -1 && currentIndex < trackQueue.length - 1) {
      playSong(trackQueue[currentIndex + 1], trackQueue);
    }
  };
  nextTrackRef.current = nextTrack;

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
    try { localStorage.setItem('musify_playlists', JSON.stringify(next)); } catch { }
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