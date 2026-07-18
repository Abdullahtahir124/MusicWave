/**
 * Spotify OAuth service — stub implementation.
 * Full Spotify OAuth is disabled; the app uses its own username/password auth.
 * SpotifyContext depends on these exports for type compatibility.
 */

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: Array<{ url: string }>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists?: Array<{ name: string }>;
  album?: { name: string; images?: Array<{ url: string }> };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  images?: Array<{ url: string }>;
  artists?: Array<{ name: string }>;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
}

export interface SpotifyCategory {
  id: string;
  name: string;
  icons?: Array<{ url: string }>;
}

function noop(): Promise<never> {
  return Promise.reject(new Error('Spotify OAuth is not configured'));
}

export const startSpotifyAuth = noop;
export const handleSpotifyAuthCallback = (_code: string, _state: string): Promise<void> => noop();
export const getSpotifyUser = (): Promise<SpotifyUser> => noop();
export const clearSpotifySession = (): void => {
  try { sessionStorage.removeItem('musicwave_spotify:tokens'); } catch { /* noop */ }
};

export const getFeaturedPlaylists = (): Promise<SpotifyPlaylist[]> => Promise.resolve([]);
export const getNewReleases = (): Promise<SpotifyAlbum[]> => Promise.resolve([]);
export const getCategories = (): Promise<SpotifyCategory[]> => Promise.resolve([]);
export const getUserPlaylists = (): Promise<SpotifyPlaylist[]> => Promise.resolve([]);
export const getSavedTracks = (): Promise<SpotifyTrack[]> => Promise.resolve([]);
export const getSavedAlbums = (): Promise<SpotifyAlbum[]> => Promise.resolve([]);
export const getRecentlyPlayed = (): Promise<SpotifyTrack[]> => Promise.resolve([]);
export const searchSpotify = (_q: string): Promise<{
  tracks?: { items: SpotifyTrack[] };
  albums?: { items: SpotifyAlbum[] };
  artists?: { items: Array<{ id: string; name: string; images?: Array<{ url: string }>; uri: string }> };
  playlists?: { items: SpotifyPlaylist[] };
}> => Promise.resolve({});

export const getPlaybackState = (): Promise<null> => Promise.resolve(null);
export const playTrack = (_uri: string): Promise<void> => noop();
export const pausePlayback = (): Promise<void> => noop();
export const nextTrackPlayback = (): Promise<void> => noop();
export const previousTrackPlayback = (): Promise<void> => noop();
export const seekPlayback = (_ms: number): Promise<void> => noop();
export const setPlaybackVolume = (_v: number): Promise<void> => noop();
