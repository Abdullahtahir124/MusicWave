import axios from 'axios';
import type { Song } from '../types';
import { MOCK_SONGS, LOCAL_RECS } from '../data/mockData';

const http = axios.create({ baseURL: '', timeout: 10_000 });

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  isCollaborative: boolean;
  createdAt: string;
  updatedAt: string;
  tracks: Song[];
}

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function searchSongs(q: string): Promise<Song[]> {
  try {
    const res = await http.get<{ results: Song[] }>('/api/search/advanced', { params: { q } });
    return res.data.results ?? [];
  } catch {
    const query = q.toLowerCase();
    const hits = MOCK_SONGS.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.artist.toLowerCase().includes(query) ||
      s.genre.toLowerCase().includes(query)
    );
    return hits.length ? hits : MOCK_SONGS;
  }
}

export async function getRecommendations(songId: string, limit = 5): Promise<Song[]> {
  try {
    const res = await http.get<{ recommendations: Song[] }>('/api/recommend', {
      params: { songId, limit },
    });
    return res.data.recommendations ?? [];
  } catch {
    return LOCAL_RECS.filter(s => s.id !== songId).slice(0, limit);
  }
}

export async function checkHealth(): Promise<{ ok: boolean; spotify: boolean }> {
  try {
    const res = await http.get<{ status: string; spotify: boolean }>('/api/health');
    return { ok: res.data.status === 'ok', spotify: !!res.data.spotify };
  } catch {
    return { ok: false, spotify: false };
  }
}

export async function registerAccount(username: string, password: string, displayName?: string): Promise<AuthResponse> {
  const res = await http.post<AuthResponse>('/api/auth/register', { username, password, displayName });
  return res.data;
}

export async function loginAccount(username: string, password: string): Promise<AuthResponse> {
  const res = await http.post<AuthResponse>('/api/auth/login', { username, password });
  return res.data;
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const res = await http.get<AuthUser>('/api/me', { headers: authHeaders(token) });
  return res.data;
}

export async function loadPlaylists(token: string): Promise<Playlist[]> {
  const res = await http.get<{ playlists: Playlist[] }>('/api/playlists', { headers: authHeaders(token) });
  return res.data.playlists ?? [];
}

export async function createUserPlaylist(token: string, name: string, description = '', collaborative = false): Promise<Playlist> {
  const res = await http.post<{ playlist: Playlist }>('/api/playlists', { name, description, collaborative }, { headers: authHeaders(token) });
  return res.data.playlist;
}

export async function updateUserPlaylist(token: string, playlistId: string, payload: { name: string; description?: string; collaborative?: boolean }): Promise<Playlist> {
  const res = await http.patch<{ playlist: Playlist }>(`/api/playlists/${playlistId}`, payload, { headers: authHeaders(token) });
  return res.data.playlist;
}

export async function deleteUserPlaylist(token: string, playlistId: string): Promise<void> {
  await http.delete(`/api/playlists/${playlistId}`, { headers: authHeaders(token) });
}

export async function addSongToUserPlaylist(token: string, playlistId: string, song: Song): Promise<Playlist> {
  const res = await http.post<{ playlist: Playlist }>(`/api/playlists/${playlistId}/tracks`, { song }, { headers: authHeaders(token) });
  return res.data.playlist;
}

export async function removeSongFromUserPlaylist(token: string, playlistId: string, songId: string): Promise<Playlist> {
  const res = await http.delete<{ playlist: Playlist }>(`/api/playlists/${playlistId}/tracks/${songId}`, { headers: authHeaders(token) });
  return res.data.playlist;
}

export async function reorderPlaylistTrack(token: string, playlistId: string, songId: string, position: number): Promise<Playlist> {
  const res = await http.post<{ playlist: Playlist }>(`/api/playlists/${playlistId}/reorder`, { songId, position }, { headers: authHeaders(token) });
  return res.data.playlist;
}

export async function loadFavorites(token: string): Promise<Song[]> {
  const res = await http.get<{ items: Song[] }>('/api/library/favorites', { headers: authHeaders(token) });
  return res.data.items ?? [];
}

export async function toggleFavoriteSong(token: string, song: Song): Promise<boolean> {
  const res = await http.post<{ liked: boolean }>('/api/library/favorites', { song }, { headers: authHeaders(token) });
  return !!res.data.liked;
}

export async function loadRecentPlays(token: string): Promise<Song[]> {
  const res = await http.get<{ items: Song[] }>('/api/library/recent', { headers: authHeaders(token) });
  return res.data.items ?? [];
}

export async function recordRecentPlay(token: string, song: Song): Promise<void> {
  await http.post('/api/library/recent', { song }, { headers: authHeaders(token) });
}

export async function loadAnalytics(token: string): Promise<{ favoritesCount: number; playlistsCount: number; recentPlaysCount: number; eventCount: number; topTracks: Song[] }> {
  const res = await http.get<{ favoritesCount: number; playlistsCount: number; recentPlaysCount: number; eventCount: number; topTracks: Song[] }>('/api/analytics/summary', { headers: authHeaders(token) });
  return res.data;
}
