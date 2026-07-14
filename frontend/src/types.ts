// ── Shared types ─────────────────────────────────────────────────────────────

export interface AudioFeatures {
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  liveness: number;
  loudness: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  coverUrl: string;
  audioUrl: string | null;
  duration: number;          // ms
  previewAvailable: boolean;
  matchScore?: number;
  features?: AudioFeatures;
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}
