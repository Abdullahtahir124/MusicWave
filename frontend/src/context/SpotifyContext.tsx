import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSpotifySession,
  getFeaturedPlaylists,
  getNewReleases,
  getPlaybackState,
  getCategories,
  getRecentlyPlayed,
  getSavedAlbums,
  getSavedTracks,
  getSpotifyUser,
  getUserPlaylists,
  handleSpotifyAuthCallback,
  pausePlayback,
  playTrack,
  previousTrackPlayback,
  nextTrackPlayback,
  searchSpotify,
  seekPlayback,
  setPlaybackVolume,
  startSpotifyAuth,
  type SpotifyAlbum,
  type SpotifyPlaylist,
  type SpotifyTrack,
  type SpotifyUser,
  type SpotifyCategory,
} from '../services/spotify';

interface PlaybackStateShape {
  is_playing: boolean;
  item?: { name: string; artists?: Array<{ name: string }> ; album?: { images?: Array<{ url: string }> }; duration_ms?: number; uri?: string };
  progress_ms?: number;
}

interface SpotifyContextType {
  user: SpotifyUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  featuredPlaylists: SpotifyPlaylist[];
  newReleases: SpotifyAlbum[];
  categories: SpotifyCategory[];
  playlists: SpotifyPlaylist[];
  savedTracks: SpotifyTrack[];
  savedAlbums: SpotifyAlbum[];
  recentTracks: SpotifyTrack[];
  searchResults: { tracks: SpotifyTrack[]; albums: SpotifyAlbum[]; artists: Array<{ id: string; name: string; images?: Array<{ url: string }>; uri: string }>; playlists: SpotifyPlaylist[] } | null;
  searchQuery: string;
  searchLoading: boolean;
  playbackState: PlaybackStateShape | null;
  playerReady: boolean;
  currentTrack: SpotifyTrack | null;
  startAuth: () => Promise<void>;
  completeAuth: (code: string, state: string) => Promise<void>;
  logout: () => void;
  search: (query: string) => Promise<void>;
  loadHomeData: () => Promise<void>;
  loadLibraryData: () => Promise<void>;
  playUri: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volumePercent: number) => Promise<void>;
}

const SpotifyCtx = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyAlbum[]>([]);
  const [categories, setCategories] = useState<SpotifyCategory[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SpotifyAlbum[]>([]);
  const [recentTracks, setRecentTracks] = useState<SpotifyTrack[]>([]);
  const [searchResults, setSearchResults] = useState<SpotifyContextType['searchResults']>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackStateShape | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const currentTrack = useMemo(() => {
    const item = playbackState?.item as SpotifyTrack | undefined;
    return item ? ({ ...item, uri: item.uri ?? '' } as SpotifyTrack) : null;
  }, [playbackState]);

  useEffect(() => {
    let ignore = false;

    async function boot() {
      try {
        const token = sessionStorage.getItem('musination_spotify:tokens');
        if (!token) {
          if (!ignore) setIsLoading(false);
          return;
        }

        const profile = await getSpotifyUser();
        if (!ignore) {
          setUser(profile);
          setIsAuthenticated(true);
        }
        await loadHomeData();
        await loadLibraryData();
      } catch {
        if (!ignore) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void boot();
    return () => { ignore = true; };
  }, []);

  async function loadHomeData() {
    const [playlistsData, releasesData, categoriesData] = await Promise.all([
      getFeaturedPlaylists(),
      getNewReleases(),
      getCategories(),
    ]);
    setFeaturedPlaylists(playlistsData);
    setNewReleases(releasesData);
    setCategories(categoriesData);
  }

  async function loadLibraryData() {
    const [playlistsData, tracksData, albumsData, recentData] = await Promise.all([
      getUserPlaylists(),
      getSavedTracks(),
      getSavedAlbums(),
      getRecentlyPlayed(),
    ]);
    setPlaylists(playlistsData);
    setSavedTracks(tracksData);
    setSavedAlbums(albumsData);
    setRecentTracks(recentData);
  }

  async function search(query: string) {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchQuery('');
      return;
    }
    setSearchLoading(true);
    setSearchQuery(query);
    try {
      const result = await searchSpotify(query);
      setSearchResults({
        tracks: result.tracks?.items ?? [],
        albums: result.albums?.items ?? [],
        artists: result.artists?.items ?? [],
        playlists: result.playlists?.items ?? [],
      });
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function syncPlayback() {
      try {
        const state = await getPlaybackState();
        if (!ignore) setPlaybackState(state);
      } catch {
        if (!ignore) setPlaybackState(null);
      }
    }

    if (!isAuthenticated) return;
    void syncPlayback();
    const id = window.setInterval(() => { void syncPlayback(); }, 10000);
    return () => { ignore = true; window.clearInterval(id); };
  }, [isAuthenticated]);

  async function startAuth() {
    await startSpotifyAuth();
  }

  async function completeAuth(code: string, state: string) {
    try {
      await handleSpotifyAuthCallback(code, state);
      const profile = await getSpotifyUser();
      setUser(profile);
      setIsAuthenticated(true);
      setIsLoading(false);
      await Promise.all([loadHomeData(), loadLibraryData()]);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  }

  async function playUri(uri: string) {
    try {
      await playTrack(uri);
      const state = await getPlaybackState();
      setPlaybackState(state);
      setPlayerReady(true);
    } catch {
      setPlayerReady(false);
    }
  }

  async function pause() { await pausePlayback(); const state = await getPlaybackState(); setPlaybackState(state); }
  async function next() { await nextTrackPlayback(); const state = await getPlaybackState(); setPlaybackState(state); }
  async function previous() { await previousTrackPlayback(); const state = await getPlaybackState(); setPlaybackState(state); }
  async function seek(positionMs: number) { await seekPlayback(positionMs); const state = await getPlaybackState(); setPlaybackState(state); }
  async function setVolume(volumePercent: number) { await setPlaybackVolume(volumePercent); const state = await getPlaybackState(); setPlaybackState(state); }

  function logout() {
    clearSpotifySession();
    setUser(null);
    setIsAuthenticated(false);
    setPlaybackState(null);
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    featuredPlaylists,
    newReleases,
    categories,
    playlists,
    savedTracks,
    savedAlbums,
    recentTracks,
    searchResults,
    searchQuery,
    searchLoading,
    playbackState,
    playerReady,
    currentTrack,
    startAuth,
    completeAuth,
    logout,
    search,
    loadHomeData,
    loadLibraryData,
    playUri,
    pause,
    next,
    previous,
    seek,
    setVolume,
  }), [user, isAuthenticated, isLoading, featuredPlaylists, newReleases, categories, playlists, savedTracks, savedAlbums, recentTracks, searchResults, searchQuery, searchLoading, playbackState, playerReady, currentTrack]);

  return <SpotifyCtx.Provider value={value}>{children}</SpotifyCtx.Provider>;
}

export function useSpotify() {
  const context = useContext(SpotifyCtx);
  if (!context) throw new Error('useSpotify must be used within a SpotifyProvider');
  return context;
}
