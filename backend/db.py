"""
User + playlist storage backed by Upstash Redis (Vercel KV).

Uses HTTPS-based REST API — no TLS driver issues on serverless runtimes.
Falls back to an in-process dict if no Redis env vars are configured (local dev).

Function signatures are kept identical to the previous MongoDB-based implementation
so backend/main.py does not need any changes.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── Redis client (Upstash / Vercel KV) ────────────────────────────────────────
# Vercel KV injects KV_REST_API_URL / KV_REST_API_TOKEN.
# Upstash direct: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
_REDIS_URL = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
_REDIS_TOKEN = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")

_redis = None
_local_store: dict[str, Any] = {}  # in-process fallback for local dev without Redis

if _REDIS_URL and _REDIS_TOKEN:
    try:
        from upstash_redis import Redis
        _redis = Redis(url=_REDIS_URL, token=_REDIS_TOKEN)
    except Exception as exc:  # pragma: no cover
        print(f"[db] Failed to init Upstash client: {exc}")
        _redis = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 50_000
    ).hex()


# ── Low-level KV wrappers ─────────────────────────────────────────────────────
# We expose get/set/delete/list-manipulation methods that work either against
# real Upstash Redis or the local in-process dict fallback.

def _kv_get(key: str) -> Optional[str]:
    if _redis:
        return _redis.get(key)
    return _local_store.get(key)


def _kv_set(key: str, value: str) -> None:
    if _redis:
        _redis.set(key, value)
    else:
        _local_store[key] = value


def _kv_delete(*keys: str) -> None:
    if not keys:
        return
    if _redis:
        _redis.delete(*keys)
    else:
        for k in keys:
            _local_store.pop(k, None)


def _kv_set_add(key: str, *members: str) -> None:
    if _redis:
        _redis.sadd(key, *members)
    else:
        s: set[str] = set(_local_store.get(key, set()))
        s.update(members)
        _local_store[key] = s


def _kv_set_remove(key: str, *members: str) -> None:
    if _redis:
        _redis.srem(key, *members)
    else:
        s: set[str] = set(_local_store.get(key, set()))
        s.difference_update(members)
        _local_store[key] = s


def _kv_set_members(key: str) -> list[str]:
    if _redis:
        return list(_redis.smembers(key) or [])
    return list(_local_store.get(key, set()))


def _load_json(raw: Optional[str], default: Any = None) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


# ── init ──────────────────────────────────────────────────────────────────────

def init_database() -> None:
    """No-op — Redis needs no schema, but we ping to warm connection & surface errors early."""
    if _redis is None:
        print("[db] No Redis configured — using in-process fallback (data will be lost on restart)")
        return
    try:
        _redis.set("__init__", _now())
    except Exception as exc:
        print(f"[db] Redis ping failed: {exc}")


# ── User helpers ──────────────────────────────────────────────────────────────

def _user_key(username: str) -> str:
    return f"user:{username.strip().lower()}"


def _user_id_key(user_id: str) -> str:
    return f"user_id:{user_id}"


def _verify_key(token: str) -> str:
    return f"verify:{token}"


def _user_from_record(rec: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": rec["id"],
        "username": rec["username"],
        "displayName": rec.get("display_name", ""),
        "createdAt": rec.get("created_at", ""),
    }


def create_user(
    username: str,
    password: str,
    display_name: Optional[str] = None,
    *,
    skip_verification: bool = False,
) -> dict[str, Any]:
    clean_username = username.strip().lower()
    if not clean_username:
        raise ValueError("Username is required")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    if _kv_get(_user_key(clean_username)):
        raise ValueError("Username already exists")

    salt = secrets.token_hex(16)
    user_id = secrets.token_hex(12)
    display = (display_name or clean_username.split("@")[0] or "Listener").strip() or "Listener"
    verification_token = secrets.token_urlsafe(32)
    verification_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    verified = skip_verification

    record = {
        "id": user_id,
        "username": clean_username,
        "display_name": display,
        "password_hash": _hash_password(password, salt),
        "password_salt": salt,
        "verified": verified,
        "created_at": _now(),
    }
    if not verified:
        record["verification_token"] = verification_token
        record["verification_expires"] = verification_expires

    _kv_set(_user_key(clean_username), _dump_json(record))
    _kv_set(_user_id_key(user_id), clean_username)
    if not verified:
        _kv_set(_verify_key(verification_token), clean_username)

    result = _user_from_record(record)
    result["verified"] = verified
    if not verified:
        result["verification_token"] = verification_token
    return result


def authenticate_user(username: str, password: str) -> Optional[dict[str, Any]]:
    clean_username = username.strip().lower()
    record = _load_json(_kv_get(_user_key(clean_username)))
    if not record:
        return None
    expected = _hash_password(password, record["password_salt"])
    if not secrets.compare_digest(expected, record["password_hash"]):
        return None
    if not record.get("verified", True):
        raise ValueError("Please verify your email before logging in")
    return _user_from_record(record)


def verify_user_email(token: str) -> Optional[dict[str, Any]]:
    username = _kv_get(_verify_key(token))
    if not username:
        return None
    record = _load_json(_kv_get(_user_key(username)))
    if not record:
        return None
    if record.get("verified"):
        return _user_from_record(record)
    expires_raw = record.get("verification_expires")
    if expires_raw and datetime.now(timezone.utc) > datetime.fromisoformat(expires_raw):
        raise ValueError("Verification link has expired")
    record["verified"] = True
    record.pop("verification_token", None)
    record.pop("verification_expires", None)
    _kv_set(_user_key(username), _dump_json(record))
    _kv_delete(_verify_key(token))
    return _user_from_record(record)


def resend_verification(username: str) -> Optional[str]:
    clean_username = username.strip().lower()
    record = _load_json(_kv_get(_user_key(clean_username)))
    if not record or record.get("verified"):
        return None
    old_token = record.get("verification_token")
    new_token = secrets.token_urlsafe(32)
    new_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    record["verification_token"] = new_token
    record["verification_expires"] = new_expires
    _kv_set(_user_key(clean_username), _dump_json(record))
    if old_token:
        _kv_delete(_verify_key(old_token))
    _kv_set(_verify_key(new_token), clean_username)
    return new_token


def get_user(user_id: str) -> Optional[dict[str, Any]]:
    username = _kv_get(_user_id_key(user_id))
    if not username:
        return None
    record = _load_json(_kv_get(_user_key(username)))
    return _user_from_record(record) if record else None


# ── Session tokens ────────────────────────────────────────────────────────────

def _token_key(token: str) -> str:
    return f"token:{token}"


def issue_token(user_id: str, ttl_days: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
    _kv_set(_token_key(token), _dump_json({
        "user_id": user_id,
        "created_at": _now(),
        "expires_at": expires_at,
    }))
    return token


def revoke_token(token: str) -> None:
    _kv_delete(_token_key(token))


def get_user_by_token(token: str) -> Optional[dict[str, Any]]:
    data = _load_json(_kv_get(_token_key(token)))
    if not data:
        return None
    if data.get("expires_at") and data["expires_at"] <= _now():
        return None
    return get_user(data["user_id"])


# ── Song serialization ────────────────────────────────────────────────────────

def _serialize_song(song: Any) -> dict[str, Any]:
    if isinstance(song, dict):
        return song
    if hasattr(song, "model_dump"):
        return song.model_dump()
    if hasattr(song, "dict"):
        return song.dict()
    raise TypeError("Unsupported song payload")


# ── Recent plays ──────────────────────────────────────────────────────────────

def _recent_key(user_id: str) -> str:
    return f"recent:{user_id}"


def record_recent_play(user_id: str, song: Any, limit: int = 50) -> None:
    song_doc = _serialize_song(song)
    entry = _dump_json({"song": song_doc, "played_at": _now()})
    key = _recent_key(user_id)
    if _redis:
        _redis.lpush(key, entry)
        _redis.ltrim(key, 0, limit - 1)
    else:
        lst = list(_local_store.get(key, []))
        lst.insert(0, entry)
        _local_store[key] = lst[:limit]


def list_recent_plays(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    key = _recent_key(user_id)
    if _redis:
        raw_list = _redis.lrange(key, 0, limit - 1) or []
    else:
        raw_list = list(_local_store.get(key, []))[:limit]
    result = []
    for raw in raw_list:
        parsed = _load_json(raw)
        if parsed and "song" in parsed:
            result.append(parsed["song"])
    return result


# ── Favorites ─────────────────────────────────────────────────────────────────
# Stored as a Redis hash where field = song_id, value = JSON song.

def _favorites_key(user_id: str) -> str:
    return f"favorites:{user_id}"


def _hset(key: str, field: str, value: str) -> None:
    if _redis:
        _redis.hset(key, field, value)
    else:
        h = dict(_local_store.get(key, {}))
        h[field] = value
        _local_store[key] = h


def _hdel(key: str, *fields: str) -> None:
    if _redis:
        _redis.hdel(key, *fields)
    else:
        h = dict(_local_store.get(key, {}))
        for f in fields:
            h.pop(f, None)
        _local_store[key] = h


def _hgetall(key: str) -> dict[str, str]:
    if _redis:
        return _redis.hgetall(key) or {}
    return dict(_local_store.get(key, {}))


def _hget(key: str, field: str) -> Optional[str]:
    if _redis:
        return _redis.hget(key, field)
    return _local_store.get(key, {}).get(field)


def toggle_favorite(user_id: str, song: Any) -> dict[str, Any]:
    song_doc = _serialize_song(song)
    song_id = str(song_doc.get("id") or "")
    if not song_id:
        raise ValueError("Song id is required")
    key = _favorites_key(user_id)
    if _hget(key, song_id):
        _hdel(key, song_id)
        return {"liked": False}
    _hset(key, song_id, _dump_json({"song": song_doc, "created_at": _now()}))
    return {"liked": True}


def list_favorites(user_id: str) -> list[dict[str, Any]]:
    raw = _hgetall(_favorites_key(user_id))
    entries: list[tuple[str, dict[str, Any]]] = []
    for _, value in raw.items():
        parsed = _load_json(value)
        if parsed and "song" in parsed:
            entries.append((parsed.get("created_at", ""), parsed["song"]))
    entries.sort(key=lambda e: e[0], reverse=True)
    return [song for _, song in entries]


# ── Playlists ─────────────────────────────────────────────────────────────────

def _playlist_key(playlist_id: str) -> str:
    return f"playlist:{playlist_id}"


def _playlist_items_key(playlist_id: str) -> str:
    return f"playlist_items:{playlist_id}"


def _user_playlists_key(user_id: str) -> str:
    return f"user_playlists:{user_id}"


def _record_to_playlist(rec: dict[str, Any], tracks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": rec["id"],
        "name": rec["name"],
        "description": rec.get("description", ""),
        "isCollaborative": bool(rec.get("is_collaborative", False)),
        "createdAt": rec.get("created_at", ""),
        "updatedAt": rec.get("updated_at", ""),
        "tracks": tracks,
    }


def _read_playlist_tracks(playlist_id: str) -> list[dict[str, Any]]:
    key = _playlist_items_key(playlist_id)
    if _redis:
        raw = _redis.lrange(key, 0, -1) or []
    else:
        raw = list(_local_store.get(key, []))
    result = []
    for r in raw:
        parsed = _load_json(r)
        if parsed:
            result.append(parsed)
    return result


def create_playlist(
    user_id: str,
    name: str,
    description: str = "",
    collaborative: bool = False,
) -> dict[str, Any]:
    playlist_id = secrets.token_hex(12)
    now = _now()
    record = {
        "id": playlist_id,
        "user_id": user_id,
        "name": name.strip() or "Untitled Playlist",
        "description": description.strip(),
        "is_collaborative": bool(collaborative),
        "created_at": now,
        "updated_at": now,
    }
    _kv_set(_playlist_key(playlist_id), _dump_json(record))
    _kv_set_add(_user_playlists_key(user_id), playlist_id)
    return _record_to_playlist(record, [])


def _load_playlist_record(playlist_id: str) -> Optional[dict[str, Any]]:
    return _load_json(_kv_get(_playlist_key(playlist_id)))


def list_playlists(user_id: str) -> list[dict[str, Any]]:
    ids = _kv_set_members(_user_playlists_key(user_id))
    records = []
    for pid in ids:
        rec = _load_playlist_record(pid)
        if rec:
            records.append(rec)
    records.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
    return [_record_to_playlist(r, _read_playlist_tracks(r["id"])) for r in records]


def get_playlist(user_id: str, playlist_id: str) -> Optional[dict[str, Any]]:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return None
    return _record_to_playlist(rec, _read_playlist_tracks(playlist_id))


def update_playlist(
    user_id: str,
    playlist_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    collaborative: Optional[bool] = None,
) -> Optional[dict[str, Any]]:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return None
    if name is not None:
        rec["name"] = name.strip() or "Untitled Playlist"
    if description is not None:
        rec["description"] = description.strip()
    if collaborative is not None:
        rec["is_collaborative"] = bool(collaborative)
    rec["updated_at"] = _now()
    _kv_set(_playlist_key(playlist_id), _dump_json(rec))
    return get_playlist(user_id, playlist_id)


def delete_playlist(user_id: str, playlist_id: str) -> bool:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return False
    _kv_delete(_playlist_key(playlist_id), _playlist_items_key(playlist_id))
    _kv_set_remove(_user_playlists_key(user_id), playlist_id)
    return True


def add_song_to_playlist(user_id: str, playlist_id: str, song: Any) -> Optional[dict[str, Any]]:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return None
    song_doc = _serialize_song(song)
    entry = _dump_json(song_doc)
    key = _playlist_items_key(playlist_id)
    if _redis:
        _redis.rpush(key, entry)
    else:
        lst = list(_local_store.get(key, []))
        lst.append(entry)
        _local_store[key] = lst
    rec["updated_at"] = _now()
    _kv_set(_playlist_key(playlist_id), _dump_json(rec))
    return get_playlist(user_id, playlist_id)


def remove_song_from_playlist(
    user_id: str, playlist_id: str, song_id: str
) -> Optional[dict[str, Any]]:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return None
    tracks = _read_playlist_tracks(playlist_id)
    remaining = [t for t in tracks if str(t.get("id")) != str(song_id)]
    _write_playlist_tracks(playlist_id, remaining)
    rec["updated_at"] = _now()
    _kv_set(_playlist_key(playlist_id), _dump_json(rec))
    return get_playlist(user_id, playlist_id)


def reorder_playlist_track(
    user_id: str, playlist_id: str, song_id: str, position: int
) -> Optional[dict[str, Any]]:
    rec = _load_playlist_record(playlist_id)
    if not rec or rec.get("user_id") != user_id:
        return None
    tracks = _read_playlist_tracks(playlist_id)
    moving = next((t for t in tracks if str(t.get("id")) == str(song_id)), None)
    if moving is None:
        return get_playlist(user_id, playlist_id)
    rest = [t for t in tracks if str(t.get("id")) != str(song_id)]
    insert_at = max(0, min(position, len(rest)))
    rest.insert(insert_at, moving)
    _write_playlist_tracks(playlist_id, rest)
    rec["updated_at"] = _now()
    _kv_set(_playlist_key(playlist_id), _dump_json(rec))
    return get_playlist(user_id, playlist_id)


def _write_playlist_tracks(playlist_id: str, tracks: list[dict[str, Any]]) -> None:
    key = _playlist_items_key(playlist_id)
    _kv_delete(key)
    if not tracks:
        return
    entries = [_dump_json(t) for t in tracks]
    if _redis:
        _redis.rpush(key, *entries)
    else:
        _local_store[key] = entries


def export_playlists(user_id: str) -> list[dict[str, Any]]:
    return list_playlists(user_id)


def import_playlists(
    user_id: str, playlists: Iterable[dict[str, Any]]
) -> list[dict[str, Any]]:
    created: list[dict[str, Any]] = []
    for playlist in playlists:
        item = create_playlist(
            user_id,
            str(playlist.get("name", "Imported Playlist")),
            str(playlist.get("description", "")),
            bool(playlist.get("isCollaborative", False)),
        )
        for track in playlist.get("tracks", []) or []:
            add_song_to_playlist(user_id, item["id"], track)
        final = get_playlist(user_id, item["id"])
        created.append(final or item)
    return created


# ── Playback state ────────────────────────────────────────────────────────────

def _playback_key(user_id: str) -> str:
    return f"playback:{user_id}"


def save_playback_state(user_id: str, state: dict[str, Any]) -> None:
    _kv_set(_playback_key(user_id), _dump_json({"state": state, "updated_at": _now()}))


def load_playback_state(user_id: str) -> dict[str, Any] | None:
    data = _load_json(_kv_get(_playback_key(user_id)))
    return data.get("state") if data else None


# ── Analytics ─────────────────────────────────────────────────────────────────

def analytics_summary(user_id: str) -> dict[str, Any]:
    favorites = list_favorites(user_id)
    playlists = list_playlists(user_id)
    recent = list_recent_plays(user_id, limit=200)
    play_count: dict[str, int] = {}
    song_lookup: dict[str, dict[str, Any]] = {}
    for song in recent:
        sid = str(song.get("id", ""))
        if not sid:
            continue
        play_count[sid] = play_count.get(sid, 0) + 1
        song_lookup[sid] = song
    top_ids = sorted(play_count.keys(), key=lambda s: play_count[s], reverse=True)[:5]
    return {
        "favoritesCount": len(favorites),
        "playlistsCount": len(playlists),
        "recentPlaysCount": len(recent),
        "eventCount": 0,
        "topTracks": [song_lookup[sid] for sid in top_ids],
    }
