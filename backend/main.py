import base64
import os
import sys
import time
from typing import Any, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.db import (
    add_song_to_playlist,
    analytics_summary,
    authenticate_user,
    create_playlist,
    create_user,
    delete_playlist,
    export_playlists,
    get_playlist,
    get_user_by_token,
    import_playlists,
    init_database,
    issue_token,
    list_favorites,
    list_playlists,
    list_recent_plays,
    load_playback_state,
    record_recent_play,
    reorder_playlist_track,
    revoke_token,
    remove_song_from_playlist,
    save_playback_state,
    toggle_favorite,
    update_playlist,
)

# Load .env from the backend/ directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Allow imports from the repo root (src/ lives there)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from src.data_loader import get_clean_data
    from src.recommender import recommend_songs as _local_recommend
except ImportError:
    get_clean_data = None       # type: ignore[assignment]
    _local_recommend = None     # type: ignore[assignment]

# ---------------------------------------------------------------------------
# App & CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Music Wave API", version="2.0.0")

# TODO: tighten allow_origins to the deployed frontend URL in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Spotify config
# ---------------------------------------------------------------------------
SPOTIFY_CLIENT_ID     = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")

# Cached token — avoids fetching a new one on every request
_token_cache: dict = {"token": "", "expires_at": 0.0}

# Fallback cover pool (used when Spotify is offline)
COVER_POOL = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300",
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300",
    "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
]
AUDIO_POOL = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
]

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class AudioFeatures(BaseModel):
    danceability: float = 0.0
    energy: float = 0.0
    valence: float = 0.0
    tempo: float = 0.0
    acousticness: float = 0.0
    instrumentalness: float = 0.0
    speechiness: float = 0.0
    liveness: float = 0.0
    loudness: float = 0.0

class Song(BaseModel):
    id: str
    title: str
    artist: str
    album: str = ""
    genre: str
    coverUrl: str
    audioUrl: Optional[str]
    duration: int
    previewAvailable: bool = False
    features: Optional[AudioFeatures] = None

class Recommendation(Song):
    matchScore: float

class SearchResponse(BaseModel):
    results: List[Song]

class RecommendationResponse(BaseModel):
    recommendations: List[Recommendation]

class TrackResponse(BaseModel):
    track: Song


class AuthRequest(BaseModel):
    username: str
    password: str
    displayName: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: dict[str, Any]


class PlaylistPayload(BaseModel):
    name: str
    description: str = ''
    collaborative: bool = False


class PlaylistTrackPayload(BaseModel):
    song: Song


class ReorderTrackPayload(BaseModel):
    songId: str
    position: int


class PlaylistImportPayload(BaseModel):
    playlists: list[dict[str, Any]]


class PlaybackStatePayload(BaseModel):
    state: dict[str, Any]


class FavoritePayload(BaseModel):
    song: Song


class RecentPlayPayload(BaseModel):
    song: Song


class SearchFilters(BaseModel):
    q: str = ''
    artist: str = ''
    album: str = ''
    genre: str = ''
    mood: str = ''
    minDuration: int = 0
    maxDuration: int = 0
    limit: int = 20


class AnalyticsResponse(BaseModel):
    favoritesCount: int
    playlistsCount: int
    recentPlaysCount: int
    eventCount: int
    topTracks: list[Song]

# ---------------------------------------------------------------------------
# Lazy DataFrame cache
# ---------------------------------------------------------------------------
_df_cache = None


@app.on_event('startup')
async def _startup() -> None:
    init_database()

def _get_df():
    global _df_cache
    if _df_cache is None and get_clean_data is not None:
        try:
            _df_cache = get_clean_data()
        except Exception as exc:
            print(f"[backend] Warning: could not load local dataset — {exc}")
    return _df_cache


def _row_get(row: Any, key: str, default: Any = '') -> Any:
    if isinstance(row, dict):
        return row.get(key, default)
    return getattr(row, key, default)


def _row_to_song_payload(row: Any, index: int) -> Song:
    return Song(
        id=str(_row_get(row, 'track_id', _row_get(row, 'id', f'local-{index}'))),
        title=str(_row_get(row, 'track_name', _row_get(row, 'title', 'Unknown'))),
        artist=str(_row_get(row, 'artists', _row_get(row, 'artist', 'Unknown'))),
        album=str(_row_get(row, 'album_name', _row_get(row, 'album', ''))),
        genre=str(_row_get(row, 'track_genre', _row_get(row, 'genre', ''))),
        coverUrl=COVER_POOL[index % len(COVER_POOL)],
        audioUrl=AUDIO_POOL[index % len(AUDIO_POOL)],
        duration=int(float(_row_get(row, 'duration_ms', _row_get(row, 'duration', 180_000)) or 180_000)),
        previewAvailable=True,
    )


def _filter_rows(rows: Any, filters: SearchFilters):
    if not rows:
        return []

    results = []
    query = filters.q.strip().lower()
    artist = filters.artist.strip().lower()
    album = filters.album.strip().lower()
    genre = (filters.genre.strip() or filters.mood.strip()).lower()

    for row in rows:
        title = str(_row_get(row, 'track_name', _row_get(row, 'title', ''))).lower()
        row_artist = str(_row_get(row, 'artists', _row_get(row, 'artist', ''))).lower()
        row_album = str(_row_get(row, 'album_name', _row_get(row, 'album', ''))).lower()
        row_genre = str(_row_get(row, 'track_genre', _row_get(row, 'genre', ''))).lower()
        duration = int(float(_row_get(row, 'duration_ms', _row_get(row, 'duration', 0)) or 0))

        if query and query not in title and query not in row_artist and query not in row_album:
            continue
        if artist and artist not in row_artist:
            continue
        if album and album not in row_album:
            continue
        if genre and genre not in row_genre:
            continue
        if filters.minDuration > 0 and duration < filters.minDuration:
            continue
        if filters.maxDuration > 0 and duration > filters.maxDuration:
            continue
        results.append(row)

    return results

def _spotify_enabled() -> bool:
    return bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET and SPOTIFY_CLIENT_ID != "YOUR_SPOTIFY_CLIENT_ID" and SPOTIFY_CLIENT_SECRET != "YOUR_SPOTIFY_CLIENT_SECRET")


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith('bearer '):
        return authorization[7:].strip() or None
    return authorization.strip() or None


def _current_user_optional(authorization: Optional[str] = Header(default=None, alias='Authorization')) -> Optional[dict[str, Any]]:
    token = _extract_bearer_token(authorization)
    return get_user_by_token(token) if token else None


def _current_user_required(authorization: Optional[str] = Header(default=None, alias='Authorization')) -> dict[str, Any]:
    user = _current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')
    return user


def _normalize_limit(limit: int, *, minimum: int = 1, maximum: int = 50) -> int:
    return min(max(limit, minimum), maximum)

# ---------------------------------------------------------------------------
# Spotify helpers — with token caching
# ---------------------------------------------------------------------------
async def _get_token() -> str:
    """Return a cached Spotify access token, refreshing if expired."""
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]

    creds = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    encoded = base64.b64encode(creds.encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
            timeout=10,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Spotify token error: {resp.text}")

    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _token_cache["token"]


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _track_to_song(t: dict, index: int = 0) -> Song:
    """Convert a Spotify track object to our Song model."""
    preview = t.get("preview_url")
    images = t.get("album", {}).get("images", [])
    cover = images[0]["url"] if images else COVER_POOL[index % len(COVER_POOL)]
    # Always assign a playable audioUrl — fall back to SoundHelix if no Spotify preview
    audio_url = preview if preview else AUDIO_POOL[index % len(AUDIO_POOL)]
    return Song(
        id=t["id"],
        title=t["name"],
        artist=", ".join(a["name"] for a in t.get("artists", [])),
        album=t.get("album", {}).get("name", ""),
        genre="",
        coverUrl=cover,
        audioUrl=audio_url,
        duration=t.get("duration_ms", 0),
        previewAvailable=True,
    )


async def _fetch_audio_features(track_id: str, token: str) -> Optional[AudioFeatures]:
    """Fetch audio features for a single track from Spotify."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.spotify.com/v1/audio-features/{track_id}",
                headers=_auth_header(token),
                timeout=8,
            )
        if resp.status_code == 200:
            d = resp.json()
            return AudioFeatures(
                danceability=d.get("danceability", 0),
                energy=d.get("energy", 0),
                valence=d.get("valence", 0),
                tempo=d.get("tempo", 0),
                acousticness=d.get("acousticness", 0),
                instrumentalness=d.get("instrumentalness", 0),
                speechiness=d.get("speechiness", 0),
                liveness=d.get("liveness", 0),
                loudness=d.get("loudness", 0),
            )
    except Exception as e:
        print(f"[backend] audio features fetch failed: {e}")
    return None


async def _fetch_artist_genre(artist_id: str, token: str) -> str:
    """Fetch the primary genre for an artist."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.spotify.com/v1/artists/{artist_id}",
                headers=_auth_header(token),
                timeout=8,
            )
        if resp.status_code == 200:
            genres = resp.json().get("genres", [])
            return genres[0].title() if genres else ""
    except Exception:
        pass
    return ""

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    spotify_ok = False
    if _spotify_enabled():
        try:
            await _get_token()
            spotify_ok = True
        except Exception:
            pass
    return {"status": "ok", "spotify": spotify_ok}


@app.get('/api/featured')
async def featured_tracks(limit: int = 12):
    """Return featured tracks from the local CSV catalog with guaranteed audio URLs."""
    safe_limit = min(max(limit, 1), 20)
    rows = _get_df()
    if rows is None:
        # Return static fallback songs if CSV not loaded
        fallback = []
        for i in range(safe_limit):
            fallback.append({
                'id': f'static-{i+1}',
                'title': ['Blinding Lights', 'Levitating', 'Stay', 'Bad Habits', 'Peaches',
                           'Good 4 U', 'Montero', 'Kiss Me More', 'Leave The Door Open',
                           'Butter', 'Dynamite', 'Watermelon Sugar', 'Mood', 'Drivers License',
                           'Positions', 'Save Your Tears', 'Deja Vu', 'Telepatia', 'Build a Bitch',
                           'Masterpiece'][i % 20],
                'artist': ['The Weeknd', 'Dua Lipa', 'The Kid LAROI', 'Ed Sheeran', 'Justin Bieber',
                           'Olivia Rodrigo', 'Lil Nas X', 'Doja Cat', 'Bruno Mars', 'BTS',
                           'BTS', 'Harry Styles', '24kGoldn', 'Olivia Rodrigo', 'Ariana Grande',
                           'The Weeknd', 'Olivia Rodrigo', 'Kali Uchis', 'Bella Poarch', 'SZA'][i % 20],
                'album': 'Featured',
                'genre': ['Pop', 'Pop', 'Hip-Hop', 'Pop', 'R&B', 'Pop', 'Hip-Hop', 'R&B', 'R&B', 'K-Pop',
                          'K-Pop', 'Pop', 'Hip-Hop', 'Pop', 'Pop', 'Pop', 'Pop', 'R&B', 'Pop', 'R&B'][i % 20],
                'coverUrl': COVER_POOL[i % len(COVER_POOL)],
                'audioUrl': AUDIO_POOL[i % len(AUDIO_POOL)],
                'duration': 200000 + (i * 10000),
                'previewAvailable': True,
            })
        return {'results': fallback[:safe_limit]}

    # Use first N rows from CSV
    row_list = rows if isinstance(rows, list) else list(rows)
    selected = row_list[:safe_limit]
    songs = [_row_to_song_payload(row, i).model_dump() for i, row in enumerate(selected)]
    return {'results': songs}


@app.get('/api/trending')
async def trending_tracks(limit: int = 20):
    """Return top trending tracks sorted by popularity from the local CSV catalog."""
    safe_limit = min(max(limit, 1), 50)
    rows = _get_df()
    if rows is None:
        fallback = []
        for i in range(safe_limit):
            fallback.append({
                'id': f'static-{i+1}',
                'title': ['Blinding Lights', 'Levitating', 'Stay', 'Bad Habits', 'Peaches',
                           'Good 4 U', 'Montero', 'Kiss Me More', 'Leave The Door Open',
                           'Butter', 'Dynamite', 'Watermelon Sugar', 'Mood', 'Drivers License',
                           'Positions', 'Save Your Tears', 'Deja Vu', 'Telepatia', 'Build a Bitch',
                           'Masterpiece'][i % 20],
                'artist': ['The Weeknd', 'Dua Lipa', 'The Kid LAROI', 'Ed Sheeran', 'Justin Bieber',
                           'Olivia Rodrigo', 'Lil Nas X', 'Doja Cat', 'Bruno Mars', 'BTS',
                           'BTS', 'Harry Styles', '24kGoldn', 'Olivia Rodrigo', 'Ariana Grande',
                           'The Weeknd', 'Olivia Rodrigo', 'Kali Uchis', 'Bella Poarch', 'SZA'][i % 20],
                'album': 'Featured',
                'genre': ['Pop', 'Pop', 'Hip-Hop', 'Pop', 'R&B', 'Pop', 'Hip-Hop', 'R&B', 'R&B', 'K-Pop',
                           'K-Pop', 'Pop', 'Hip-Hop', 'Pop', 'Pop', 'Pop', 'Pop', 'R&B', 'Pop', 'R&B'][i % 20],
                'coverUrl': COVER_POOL[i % len(COVER_POOL)],
                'audioUrl': AUDIO_POOL[i % len(AUDIO_POOL)],
                'duration': 200000 + (i * 10000),
                'previewAvailable': True,
            })
        return {'results': fallback[:safe_limit]}

    def get_pop(r):
        try:
            return int(float(_row_get(r, 'popularity', 0)))
        except Exception:
            return 0

    sorted_rows = sorted(rows, key=get_pop, reverse=True)
    selected = sorted_rows[:safe_limit]
    songs = [_row_to_song_payload(row, i).model_dump() for i, row in enumerate(selected)]
    return {'results': songs}


@app.get('/api/artists')
async def api_artists(limit: int = 50):
    rows = _get_df()
    if not rows:
        return {'artists': []}
    
    artist_map = {}
    for i, row in enumerate(rows):
        artist_names = _row_get(row, 'artists', '')
        if not artist_names:
            continue
        primary_artist = artist_names.split(';')[0].strip()
        if not primary_artist:
            continue
            
        if primary_artist not in artist_map:
            popularity = int(float(_row_get(row, 'popularity', 0)))
            artist_map[primary_artist] = {
                'id': f"art-{len(artist_map)}",
                'name': primary_artist,
                'popularity': popularity,
                'songs': [],
                'genre': _row_get(row, 'track_genre', ''),
            }
        
        if len(artist_map[primary_artist]['songs']) < 5:
            artist_map[primary_artist]['songs'].append(_row_to_song_payload(row, i).model_dump())
            
    sorted_artists = sorted(artist_map.values(), key=lambda a: a['popularity'], reverse=True)
    
    formatted = []
    for art in sorted_artists[:limit]:
        import hashlib
        h = int(hashlib.md5(art['name'].encode('utf-8')).hexdigest(), 16)
        cover_idx = h % len(COVER_POOL)
        
        followers = (art['popularity'] * 123456) + (h % 100000)
        listeners = (art['popularity'] * 98765) + (h % 50000)
        
        colors = ['#8B0000', '#1a006b', '#5c3d00', '#6b006b', '#00456b', '#001a6b']
        color = colors[h % len(colors)]
        
        formatted.append({
            'id': art['id'],
            'name': art['name'],
            'image': COVER_POOL[cover_idx],
            'genre': art['genre'].title() or 'Pop',
            'followers': followers,
            'monthlyListeners': listeners,
            'color': color,
            'songs': art['songs'],
        })
        
    return {'artists': formatted}


@app.get("/api/search", response_model=SearchResponse)
async def search_songs(q: str = Query(..., min_length=2)):
    # ── Spotify path ────────────────────────────────────────────────────────
    if _spotify_enabled():
        try:
            token = await _get_token()
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.spotify.com/v1/search",
                    # Request 20 results so the UI has plenty to show
                    params={"q": q, "type": "track", "limit": 20, "market": "US"},
                    headers=_auth_header(token),
                    timeout=10,
                )
            if resp.status_code == 200:
                items = resp.json().get("tracks", {}).get("items", [])
                results: List[Song] = []
                for t in items:
                    song = _track_to_song(t)
                    # Fetch genre from first artist (best-effort, skip on error)
                    if t.get("artists"):
                        try:
                            song.genre = await _fetch_artist_genre(t["artists"][0]["id"], token)
                        except Exception:
                            song.genre = ""
                    results.append(song)
                return SearchResponse(results=results)
        except Exception as exc:
            print(f"[backend] Spotify search failed: {exc} — falling back to CSV")

    # ── Local CSV fallback ───────────────────────────────────────────────────
    rows = _get_df()
    if not rows:
        return SearchResponse(results=[])

    filters = SearchFilters(q=q)
    matches = _filter_rows(rows, filters)[:20]
    results = [_row_to_song_payload(row, index) for index, row in enumerate(matches)]
    return SearchResponse(results=results)


@app.get("/api/track/{track_id}", response_model=TrackResponse)
async def get_track(track_id: str):
    """Fetch full track info including audio features — used for the Acoustic DNA panel."""
    if not _spotify_enabled():
        raise RuntimeError("Spotify not configured")

    token = await _get_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers=_auth_header(token),
            timeout=10,
        )
    if resp.status_code != 200:
        return TrackResponse(track=Song(
            id=track_id, title="Unknown", artist="Unknown", genre="",
            coverUrl="", audioUrl=None, duration=0
        ))

    track = resp.json()
    song = _track_to_song(track)
    if track.get("artists"):
        song.genre = await _fetch_artist_genre(track["artists"][0]["id"], token)
    song.features = await _fetch_audio_features(track_id, token)
    return TrackResponse(track=song)


@app.get("/api/recommend", response_model=RecommendationResponse)
async def recommend_songs(songId: str, limit: int = 5):
    limit = min(max(limit, 1), 10)

    # ── Try Spotify audio-feature-based similarity ───────────────────────────
    # Spotify's /recommendations endpoint is deprecated for new apps (May 2024).
    # Instead: fetch the seed track's audio features, then find similar tracks
    # by searching related artists and scoring by feature distance.
    if _spotify_enabled():
        try:
            token = await _get_token()
            seed_features = await _fetch_audio_features(songId, token)

            if seed_features:
                # Get the seed track to find its artist
                async with httpx.AsyncClient() as client:
                    t_resp = await client.get(
                        f"https://api.spotify.com/v1/tracks/{songId}",
                        headers=_auth_header(token),
                        timeout=10,
                    )
                if t_resp.status_code == 200:
                    seed_track = t_resp.json()
                    artist_id = seed_track["artists"][0]["id"] if seed_track.get("artists") else None

                    candidates: list = []
                    if artist_id:
                        # Fetch artist's top tracks + related artists' top tracks
                        async with httpx.AsyncClient() as client:
                            r1 = await client.get(
                                f"https://api.spotify.com/v1/artists/{artist_id}/top-tracks",
                                params={"market": "US"},
                                headers=_auth_header(token),
                                timeout=10,
                            )
                            r2 = await client.get(
                                f"https://api.spotify.com/v1/artists/{artist_id}/related-artists",
                                headers=_auth_header(token),
                                timeout=10,
                            )

                        if r1.status_code == 200:
                            candidates += r1.json().get("tracks", [])
                        if r2.status_code == 200:
                            related = r2.json().get("artists", [])[:3]
                            for rel in related:
                                async with httpx.AsyncClient() as client:
                                    rt = await client.get(
                                        f"https://api.spotify.com/v1/artists/{rel['id']}/top-tracks",
                                        params={"market": "US"},
                                        headers=_auth_header(token),
                                        timeout=10,
                                    )
                                if rt.status_code == 200:
                                    candidates += rt.json().get("tracks", [])

                    # Remove the seed song itself
                    candidates = [c for c in candidates if c["id"] != songId]
                    # Deduplicate by id
                    seen: set = set()
                    unique: list = []
                    for c in candidates:
                        if c["id"] not in seen:
                            seen.add(c["id"])
                            unique.append(c)

                    # Score each candidate by audio feature cosine similarity
                    import math

                    def cosine(a: AudioFeatures, b: AudioFeatures) -> float:
                        keys = ["danceability","energy","valence","tempo",
                                "acousticness","instrumentalness","speechiness","liveness"]
                        va = [getattr(a, k) for k in keys]
                        vb = [getattr(b, k) for k in keys]
                        dot = sum(x*y for x,y in zip(va,vb))
                        na = math.sqrt(sum(x*x for x in va))
                        nb = math.sqrt(sum(x*x for x in vb))
                        return dot / (na * nb) if na * nb > 0 else 0.0

                    scored: list = []
                    for c in unique[:30]:  # score top 30 candidates
                        cf = await _fetch_audio_features(c["id"], token)
                        if cf:
                            score = cosine(seed_features, cf)
                            scored.append((score, c, cf))

                    scored.sort(key=lambda x: x[0], reverse=True)
                    recs: List[Recommendation] = []
                    for score, t, feat in scored[:limit]:
                        song = _track_to_song(t)
                        if t.get("artists"):
                            song.genre = await _fetch_artist_genre(
                                t["artists"][0]["id"], token
                            )
                        song.features = feat
                        recs.append(Recommendation(**song.model_dump(), matchScore=round(score, 4)))
                    if recs:
                        return RecommendationResponse(recommendations=recs)
        except Exception as exc:
            print(f"[backend] Spotify recommendations failed: {exc} — falling back to CSV")

    # ── Local CSV cosine-similarity fallback ────────────────────────────────
    rows = _get_df()
    if not rows or _local_recommend is None:
        return RecommendationResponse(recommendations=[])

    recs_rows = _local_recommend(rows, songId, limit)
    if not recs_rows:
        return RecommendationResponse(recommendations=[])

    recs = [
        Recommendation(
            id=str(_row_get(row, 'track_name', _row_get(row, 'id', f'rec-{i}'))),
            title=str(_row_get(row, 'track_name', _row_get(row, 'title', 'Unknown'))),
            artist=str(_row_get(row, 'artists', _row_get(row, 'artist', 'Unknown'))),
            album=str(_row_get(row, 'album_name', _row_get(row, 'album', ''))),
            genre=str(_row_get(row, 'track_genre', _row_get(row, 'genre', ''))),
            coverUrl=COVER_POOL[(i + 1) % len(COVER_POOL)],
            audioUrl=AUDIO_POOL[(i + 1) % len(AUDIO_POOL)],
            duration=int(float(_row_get(row, 'duration_ms', _row_get(row, 'duration', 180_000)) or 180_000)),
            previewAvailable=True,
            matchScore=float(_row_get(row, 'similarity', 0.85)),
        )
        for i, row in enumerate(recs_rows)
    ]
    return RecommendationResponse(recommendations=recs)


@app.get('/api/proxy')
async def proxy(url: str = Query(...)):
    """Simple proxy to fetch audio resources server-side to avoid CORS issues in the browser.
    Usage: /api/proxy?url=<encoded-url>
    """
    if not url or not url.startswith('http'):
        return Response(content='Invalid url', status_code=400)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, follow_redirects=True, timeout=20)
    except Exception as exc:
        return Response(content=f'Fetch failed: {exc}', status_code=502)

    content_type = resp.headers.get('content-type', 'application/octet-stream')
    return Response(content=resp.content, media_type=content_type)


@app.post('/api/auth/register', response_model=AuthResponse)
async def register(payload: AuthRequest):
    try:
        user = create_user(payload.username, payload.password, payload.displayName)
        token = issue_token(user['id'])
        return AuthResponse(token=token, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.post('/api/auth/login', response_model=AuthResponse)
async def login(payload: AuthRequest):
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid username or password')
    token = issue_token(user['id'])
    return AuthResponse(token=token, user=user)


@app.post('/api/auth/logout')
async def logout(authorization: Optional[str] = Header(default=None, alias='Authorization')):
    token = _extract_bearer_token(authorization)
    if token:
        revoke_token(token)
    return {'status': 'ok'}


@app.get('/api/me')
async def me(current_user: dict[str, Any] = Depends(_current_user_required)):
    return current_user


@app.get('/api/search/advanced', response_model=SearchResponse)
async def advanced_search(
    q: str = '',
    artist: str = '',
    album: str = '',
    genre: str = '',
    mood: str = '',
    minDuration: int = 0,
    maxDuration: int = 0,
    limit: int = 20,
):
    search_limit = _normalize_limit(limit, maximum=50)
    filters = SearchFilters(
        q=q,
        artist=artist,
        album=album,
        genre=genre,
        mood=mood,
        minDuration=max(0, minDuration),
        maxDuration=max(0, maxDuration),
        limit=search_limit,
    )

    if _spotify_enabled() and filters.q.strip():
        try:
            token = await _get_token()
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    'https://api.spotify.com/v1/search',
                    params={'q': filters.q, 'type': 'track', 'limit': search_limit, 'market': 'US'},
                    headers=_auth_header(token),
                    timeout=10,
                )
            if resp.status_code == 200:
                items = resp.json().get('tracks', {}).get('items', [])
                results: list[Song] = []
                for item in items:
                    song = _track_to_song(item)
                    if filters.artist and filters.artist.lower() not in song.artist.lower():
                        continue
                    if filters.album and filters.album.lower() not in song.album.lower():
                        continue
                    if filters.genre and filters.genre.lower() not in song.genre.lower():
                        continue
                    results.append(song)
                return SearchResponse(results=results[:search_limit])
        except Exception as exc:
            print(f'[backend] advanced Spotify search failed: {exc} — falling back to CSV')

    df = _get_df()
    if not df:
        return SearchResponse(results=[])

    filtered = _filter_rows(df, filters)
    if not filtered:
        return SearchResponse(results=[])

    results = [
        _row_to_song_payload(row, index)
        for index, row in enumerate(filtered[:search_limit])
    ]
    return SearchResponse(results=results)


@app.get('/api/playlists')
async def api_list_playlists(current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'playlists': list_playlists(current_user['id'])}


@app.post('/api/playlists')
async def api_create_playlist(payload: PlaylistPayload, current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'playlist': create_playlist(current_user['id'], payload.name, payload.description, payload.collaborative)}


@app.get('/api/playlists/export')
async def api_export_playlists(current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'playlists': export_playlists(current_user['id'])}


@app.post('/api/playlists/import')
async def api_import_playlists(payload: PlaylistImportPayload, current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'playlists': import_playlists(current_user['id'], payload.playlists)}


@app.get('/api/playlists/{playlist_id}')
async def api_get_playlist(playlist_id: str, current_user: dict[str, Any] = Depends(_current_user_required)):
    playlist = get_playlist(current_user['id'], playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'playlist': playlist}


@app.patch('/api/playlists/{playlist_id}')
async def api_update_playlist(
    playlist_id: str,
    payload: PlaylistPayload,
    current_user: dict[str, Any] = Depends(_current_user_required),
):
    playlist = update_playlist(
        current_user['id'],
        playlist_id,
        name=payload.name,
        description=payload.description,
        collaborative=payload.collaborative,
    )
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'playlist': playlist}


@app.delete('/api/playlists/{playlist_id}')
async def api_delete_playlist(playlist_id: str, current_user: dict[str, Any] = Depends(_current_user_required)):
    deleted = delete_playlist(current_user['id'], playlist_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'status': 'deleted'}


@app.post('/api/playlists/{playlist_id}/tracks')
async def api_add_playlist_track(
    playlist_id: str,
    payload: PlaylistTrackPayload,
    current_user: dict[str, Any] = Depends(_current_user_required),
):
    playlist = add_song_to_playlist(current_user['id'], playlist_id, payload.song)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'playlist': playlist}


@app.delete('/api/playlists/{playlist_id}/tracks/{song_id}')
async def api_remove_playlist_track(
    playlist_id: str,
    song_id: str,
    current_user: dict[str, Any] = Depends(_current_user_required),
):
    playlist = remove_song_from_playlist(current_user['id'], playlist_id, song_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'playlist': playlist}


@app.post('/api/playlists/{playlist_id}/reorder')
async def api_reorder_playlist_track(
    playlist_id: str,
    payload: ReorderTrackPayload,
    current_user: dict[str, Any] = Depends(_current_user_required),
):
    playlist = reorder_playlist_track(current_user['id'], playlist_id, payload.songId, payload.position)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Playlist not found')
    return {'playlist': playlist}


@app.get('/api/library/favorites')
async def api_list_favorites(current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'items': list_favorites(current_user['id'])}


@app.post('/api/library/favorites')
async def api_toggle_favorite(payload: FavoritePayload, current_user: dict[str, Any] = Depends(_current_user_required)):
    result = toggle_favorite(current_user['id'], payload.song)
    return {'liked': result['liked']}


@app.get('/api/library/recent')
async def api_list_recent(current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'items': list_recent_plays(current_user['id'])}


@app.post('/api/library/recent')
async def api_record_recent(payload: RecentPlayPayload, current_user: dict[str, Any] = Depends(_current_user_required)):
    record_recent_play(current_user['id'], payload.song)
    return {'status': 'ok'}


@app.get('/api/playback/state')
async def api_get_playback_state(current_user: dict[str, Any] = Depends(_current_user_required)):
    return {'state': load_playback_state(current_user['id'])}


@app.put('/api/playback/state')
async def api_save_playback_state(payload: PlaybackStatePayload, current_user: dict[str, Any] = Depends(_current_user_required)):
    save_playback_state(current_user['id'], payload.state)
    return {'status': 'ok'}


@app.get('/api/analytics/summary', response_model=AnalyticsResponse)
async def api_analytics_summary(current_user: dict[str, Any] = Depends(_current_user_required)):
    summary = analytics_summary(current_user['id'])
    return AnalyticsResponse(
        favoritesCount=summary['favoritesCount'],
        playlistsCount=summary['playlistsCount'],
        recentPlaysCount=summary['recentPlaysCount'],
        eventCount=summary['eventCount'],
        topTracks=[Song(**track) for track in summary['topTracks']],
    )

# ---------------------------------------------------------------------------
# Serve built frontend (production deployment)
# ---------------------------------------------------------------------------
_FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend", "dist"
)

if os.path.isdir(_FRONTEND_DIST):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Catch-all: serve the React SPA for any non-API route."""
        index = os.path.join(_FRONTEND_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return Response(content="Frontend not built. Run `npm run build` in the frontend/ folder.", status_code=404)
