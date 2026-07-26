"""
User + playlist storage backed by Supabase (Postgres via HTTPS REST API).

Uses the supabase-py client which talks to Supabase over HTTPS —
no TLS driver issues on serverless runtimes.

Falls back to an in-process dict if no Supabase env vars are configured (local dev).

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

# ── Supabase client ───────────────────────────────────────────────────────────
_SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
_SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
).strip()

_client = None
_local_store: dict[str, list[dict[str, Any]]] = {  # in-process fallback
    "users": [], "tokens": [], "favorites": [], "recent_plays": [],
    "playlists": [], "playlist_items": [], "playback_state": [],
}

if _SUPABASE_URL and _SUPABASE_KEY:
    try:
        from supabase import create_client
        _client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    except Exception as exc:  # pragma: no cover
        print(f"[db] Failed to init Supabase client: {exc}")
        _client = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 50_000
    ).hex()


# ── init ──────────────────────────────────────────────────────────────────────

def init_database() -> None:
    """No-op — schema is managed via SQL in the Supabase dashboard."""
    if _client is None:
        print("[db] No Supabase configured — using in-process fallback (data lost on restart)")


# ── User helpers ──────────────────────────────────────────────────────────────

def _user_to_public(rec: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": rec["id"],
        "username": rec["username"],
        "displayName": rec.get("display_name", ""),
        "createdAt": rec.get("created_at", ""),
    }


def _local_find(table: str, **filters: Any) -> list[dict[str, Any]]:
    rows = _local_store.get(table, [])
    return [r for r in rows if all(r.get(k) == v for k, v in filters.items())]


def _local_upsert(table: str, row: dict[str, Any], key: str) -> None:
    rows = _local_store.setdefault(table, [])
    for i, existing in enumerate(rows):
        if existing.get(key) == row.get(key):
            rows[i] = row
            return
    rows.append(row)


def _local_delete(table: str, **filters: Any) -> int:
    rows = _local_store.get(table, [])
    remaining = [r for r in rows if not all(r.get(k) == v for k, v in filters.items())]
    _local_store[table] = remaining
    return len(rows) - len(remaining)


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

    # Duplicate check
    if _client:
        existing = _client.table("users").select("id").eq("username", clean_username).execute()
        if existing.data:
            raise ValueError("Username already exists")
    else:
        if _local_find("users", username=clean_username):
            raise ValueError("Username already exists")

    salt = secrets.token_hex(16)
    user_id = secrets.token_hex(12)
    display = (display_name or clean_username.split("@")[0] or "Listener").strip() or "Listener"
    now = _now()
    verified = skip_verification
    verification_token = None if verified else secrets.token_urlsafe(32)
    verification_expires = None if verified else (
        datetime.now(timezone.utc) + timedelta(hours=24)
    ).isoformat()

    record = {
        "id": user_id,
        "username": clean_username,
        "display_name": display,
        "password_hash": _hash_password(password, salt),
        "password_salt": salt,
        "verified": verified,
        "verification_token": verification_token,
        "verification_expires": verification_expires,
        "created_at": now,
    }

    if _client:
        _client.table("users").insert(record).execute()
    else:
        _local_store["users"].append(record)

    result = _user_to_public(record)
    result["verified"] = verified
    if verification_token:
        result["verification_token"] = verification_token
    return result


def authenticate_user(username: str, password: str) -> Optional[dict[str, Any]]:
    clean_username = username.strip().lower()
    if _client:
        res = _client.table("users").select("*").eq("username", clean_username).limit(1).execute()
        record = res.data[0] if res.data else None
    else:
        rows = _local_find("users", username=clean_username)
        record = rows[0] if rows else None
    if not record:
        return None
    expected = _hash_password(password, record["password_salt"])
    if not secrets.compare_digest(expected, record["password_hash"]):
        return None
    if not record.get("verified", True):
        raise ValueError("Please verify your email before logging in")
    return _user_to_public(record)


def verify_user_email(token: str) -> Optional[dict[str, Any]]:
    if _client:
        res = _client.table("users").select("*").eq("verification_token", token).limit(1).execute()
        record = res.data[0] if res.data else None
    else:
        rows = _local_find("users", verification_token=token)
        record = rows[0] if rows else None
    if not record:
        return None
    if record.get("verified"):
        return _user_to_public(record)
    expires_raw = record.get("verification_expires")
    if expires_raw and datetime.now(timezone.utc) > datetime.fromisoformat(expires_raw):
        raise ValueError("Verification link has expired")
    updates = {"verified": True, "verification_token": None, "verification_expires": None}
    if _client:
        _client.table("users").update(updates).eq("id", record["id"]).execute()
    else:
        record.update(updates)
    return _user_to_public(record)


def resend_verification(username: str) -> Optional[str]:
    clean_username = username.strip().lower()
    if _client:
        res = _client.table("users").select("*").eq("username", clean_username).limit(1).execute()
        record = res.data[0] if res.data else None
    else:
        rows = _local_find("users", username=clean_username)
        record = rows[0] if rows else None
    if not record or record.get("verified"):
        return None
    new_token = secrets.token_urlsafe(32)
    new_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    updates = {"verification_token": new_token, "verification_expires": new_expires}
    if _client:
        _client.table("users").update(updates).eq("id", record["id"]).execute()
    else:
        record.update(updates)
    return new_token


def get_user(user_id: str) -> Optional[dict[str, Any]]:
    if _client:
        res = _client.table("users").select("*").eq("id", user_id).limit(1).execute()
        record = res.data[0] if res.data else None
    else:
        rows = _local_find("users", id=user_id)
        record = rows[0] if rows else None
    return _user_to_public(record) if record else None


# ── Session tokens ────────────────────────────────────────────────────────────

def issue_token(user_id: str, ttl_days: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
    row = {"token": token, "user_id": user_id, "created_at": now, "expires_at": expires_at}
    if _client:
        _client.table("tokens").insert(row).execute()
    else:
        _local_store["tokens"].append(row)
    return token


def revoke_token(token: str) -> None:
    if _client:
        _client.table("tokens").delete().eq("token", token).execute()
    else:
        _local_delete("tokens", token=token)


def get_user_by_token(token: str) -> Optional[dict[str, Any]]:
    now = _now()
    if _client:
        res = _client.table("tokens").select("*").eq("token", token).limit(1).execute()
        tok = res.data[0] if res.data else None
    else:
        rows = _local_find("tokens", token=token)
        tok = rows[0] if rows else None
    if not tok:
        return None
    if tok.get("expires_at") and tok["expires_at"] <= now:
        return None
    return get_user(tok["user_id"])


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

def record_recent_play(user_id: str, song: Any, limit: int = 50) -> None:
    song_doc = _serialize_song(song)
    song_id = str(song_doc.get("id") or "")
    if not song_id:
        return
    row = {"user_id": user_id, "song_id": song_id, "song": song_doc, "played_at": _now()}
    if _client:
        _client.table("recent_plays").insert(row).execute()
        # Trim: fetch ids past the limit and delete them
        res = _client.table("recent_plays").select("id").eq("user_id", user_id).order(
            "played_at", desc=True
        ).range(limit, limit + 1000).execute()
        old_ids = [r["id"] for r in (res.data or [])]
        if old_ids:
            _client.table("recent_plays").delete().in_("id", old_ids).execute()
    else:
        _local_store["recent_plays"].append(row)


def list_recent_plays(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    if _client:
        res = _client.table("recent_plays").select("song,played_at").eq(
            "user_id", user_id
        ).order("played_at", desc=True).limit(limit).execute()
        return [r["song"] for r in (res.data or [])]
    rows = [r for r in _local_store["recent_plays"] if r["user_id"] == user_id]
    rows.sort(key=lambda r: r.get("played_at", ""), reverse=True)
    return [r["song"] for r in rows[:limit]]


# ── Favorites ─────────────────────────────────────────────────────────────────

def toggle_favorite(user_id: str, song: Any) -> dict[str, Any]:
    song_doc = _serialize_song(song)
    song_id = str(song_doc.get("id") or "")
    if not song_id:
        raise ValueError("Song id is required")
    if _client:
        existing = _client.table("favorites").select("id").eq("user_id", user_id).eq(
            "song_id", song_id
        ).execute()
        if existing.data:
            _client.table("favorites").delete().eq("user_id", user_id).eq(
                "song_id", song_id
            ).execute()
            return {"liked": False}
        _client.table("favorites").insert({
            "user_id": user_id, "song_id": song_id, "song": song_doc, "created_at": _now(),
        }).execute()
        return {"liked": True}
    matches = _local_find("favorites", user_id=user_id, song_id=song_id)
    if matches:
        _local_delete("favorites", user_id=user_id, song_id=song_id)
        return {"liked": False}
    _local_store["favorites"].append({
        "user_id": user_id, "song_id": song_id, "song": song_doc, "created_at": _now(),
    })
    return {"liked": True}


def list_favorites(user_id: str) -> list[dict[str, Any]]:
    if _client:
        res = _client.table("favorites").select("song,created_at").eq(
            "user_id", user_id
        ).order("created_at", desc=True).execute()
        return [r["song"] for r in (res.data or [])]
    rows = [r for r in _local_store["favorites"] if r["user_id"] == user_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return [r["song"] for r in rows]


# ── Playlists ─────────────────────────────────────────────────────────────────

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


def _list_tracks(playlist_id: str) -> list[dict[str, Any]]:
    if _client:
        res = _client.table("playlist_items").select("song,position").eq(
            "playlist_id", playlist_id
        ).order("position", desc=False).execute()
        return [r["song"] for r in (res.data or [])]
    rows = [r for r in _local_store["playlist_items"] if r["playlist_id"] == playlist_id]
    rows.sort(key=lambda r: r.get("position", 0))
    return [r["song"] for r in rows]


def create_playlist(
    user_id: str, name: str, description: str = "", collaborative: bool = False
) -> dict[str, Any]:
    playlist_id = secrets.token_hex(12)
    now = _now()
    rec = {
        "id": playlist_id,
        "user_id": user_id,
        "name": name.strip() or "Untitled Playlist",
        "description": description.strip(),
        "is_collaborative": bool(collaborative),
        "created_at": now,
        "updated_at": now,
    }
    if _client:
        _client.table("playlists").insert(rec).execute()
    else:
        _local_store["playlists"].append(rec)
    return _record_to_playlist(rec, [])


def list_playlists(user_id: str) -> list[dict[str, Any]]:
    if _client:
        res = _client.table("playlists").select("*").eq("user_id", user_id).order(
            "updated_at", desc=True
        ).execute()
        records = res.data or []
    else:
        records = [r for r in _local_store["playlists"] if r["user_id"] == user_id]
        records.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
    return [_record_to_playlist(r, _list_tracks(r["id"])) for r in records]


def get_playlist(user_id: str, playlist_id: str) -> Optional[dict[str, Any]]:
    if _client:
        res = _client.table("playlists").select("*").eq("id", playlist_id).eq(
            "user_id", user_id
        ).limit(1).execute()
        rec = res.data[0] if res.data else None
    else:
        rows = _local_find("playlists", id=playlist_id, user_id=user_id)
        rec = rows[0] if rows else None
    if not rec:
        return None
    return _record_to_playlist(rec, _list_tracks(playlist_id))


def update_playlist(
    user_id: str, playlist_id: str, *,
    name: Optional[str] = None, description: Optional[str] = None,
    collaborative: Optional[bool] = None,
) -> Optional[dict[str, Any]]:
    updates: dict[str, Any] = {"updated_at": _now()}
    if name is not None:
        updates["name"] = name.strip() or "Untitled Playlist"
    if description is not None:
        updates["description"] = description.strip()
    if collaborative is not None:
        updates["is_collaborative"] = bool(collaborative)
    if _client:
        _client.table("playlists").update(updates).eq("id", playlist_id).eq(
            "user_id", user_id
        ).execute()
    else:
        for r in _local_store["playlists"]:
            if r["id"] == playlist_id and r["user_id"] == user_id:
                r.update(updates)
    return get_playlist(user_id, playlist_id)


def delete_playlist(user_id: str, playlist_id: str) -> bool:
    if _client:
        res = _client.table("playlists").delete().eq("id", playlist_id).eq(
            "user_id", user_id
        ).execute()
        deleted = bool(res.data)
        if deleted:
            _client.table("playlist_items").delete().eq("playlist_id", playlist_id).execute()
        return deleted
    removed = _local_delete("playlists", id=playlist_id, user_id=user_id)
    if removed:
        _local_delete("playlist_items", playlist_id=playlist_id)
        return True
    return False


def add_song_to_playlist(
    user_id: str, playlist_id: str, song: Any
) -> Optional[dict[str, Any]]:
    # Ownership check
    if _client:
        owner = _client.table("playlists").select("id").eq("id", playlist_id).eq(
            "user_id", user_id
        ).limit(1).execute()
        if not owner.data:
            return None
    else:
        if not _local_find("playlists", id=playlist_id, user_id=user_id):
            return None
    song_doc = _serialize_song(song)
    if _client:
        last = _client.table("playlist_items").select("position").eq(
            "playlist_id", playlist_id
        ).order("position", desc=True).limit(1).execute()
        next_pos = ((last.data[0]["position"] + 1) if last.data else 1)
        _client.table("playlist_items").insert({
            "playlist_id": playlist_id, "position": next_pos,
            "song": song_doc, "added_at": _now(),
        }).execute()
        _client.table("playlists").update({"updated_at": _now()}).eq(
            "id", playlist_id
        ).execute()
    else:
        items = [r for r in _local_store["playlist_items"] if r["playlist_id"] == playlist_id]
        next_pos = max((r["position"] for r in items), default=0) + 1
        _local_store["playlist_items"].append({
            "playlist_id": playlist_id, "position": next_pos,
            "song": song_doc, "added_at": _now(),
        })
        for r in _local_store["playlists"]:
            if r["id"] == playlist_id:
                r["updated_at"] = _now()
    return get_playlist(user_id, playlist_id)


def remove_song_from_playlist(
    user_id: str, playlist_id: str, song_id: str
) -> Optional[dict[str, Any]]:
    if _client:
        owner = _client.table("playlists").select("id").eq("id", playlist_id).eq(
            "user_id", user_id
        ).limit(1).execute()
        if not owner.data:
            return None
        # Fetch items to filter by nested song.id (Supabase JSONB filter uses ->>)
        items = _client.table("playlist_items").select("id,song").eq(
            "playlist_id", playlist_id
        ).execute()
        ids_to_del = [it["id"] for it in (items.data or []) if str(it["song"].get("id")) == str(song_id)]
        if ids_to_del:
            _client.table("playlist_items").delete().in_("id", ids_to_del).execute()
        _client.table("playlists").update({"updated_at": _now()}).eq("id", playlist_id).execute()
    else:
        if not _local_find("playlists", id=playlist_id, user_id=user_id):
            return None
        _local_store["playlist_items"] = [
            r for r in _local_store["playlist_items"]
            if not (r["playlist_id"] == playlist_id and str(r["song"].get("id")) == str(song_id))
        ]
        for r in _local_store["playlists"]:
            if r["id"] == playlist_id:
                r["updated_at"] = _now()
    return get_playlist(user_id, playlist_id)


def reorder_playlist_track(
    user_id: str, playlist_id: str, song_id: str, position: int
) -> Optional[dict[str, Any]]:
    if _client:
        owner = _client.table("playlists").select("id").eq("id", playlist_id).eq(
            "user_id", user_id
        ).limit(1).execute()
        if not owner.data:
            return None
        items_res = _client.table("playlist_items").select("*").eq(
            "playlist_id", playlist_id
        ).order("position", desc=False).execute()
        items = items_res.data or []
    else:
        if not _local_find("playlists", id=playlist_id, user_id=user_id):
            return None
        items = [r for r in _local_store["playlist_items"] if r["playlist_id"] == playlist_id]
        items.sort(key=lambda r: r.get("position", 0))
    moving = next((it for it in items if str(it["song"].get("id")) == str(song_id)), None)
    if moving is None:
        return get_playlist(user_id, playlist_id)
    rest = [it for it in items if str(it["song"].get("id")) != str(song_id)]
    insert_at = max(0, min(position, len(rest)))
    rest.insert(insert_at, moving)
    for idx, item in enumerate(rest, start=1):
        if _client:
            _client.table("playlist_items").update({"position": idx}).eq(
                "id", item["id"]
            ).execute()
        else:
            item["position"] = idx
    if _client:
        _client.table("playlists").update({"updated_at": _now()}).eq("id", playlist_id).execute()
    else:
        for r in _local_store["playlists"]:
            if r["id"] == playlist_id:
                r["updated_at"] = _now()
    return get_playlist(user_id, playlist_id)


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

def save_playback_state(user_id: str, state: dict[str, Any]) -> None:
    row = {"user_id": user_id, "state": state, "updated_at": _now()}
    if _client:
        _client.table("playback_state").upsert(row, on_conflict="user_id").execute()
    else:
        for r in _local_store["playback_state"]:
            if r["user_id"] == user_id:
                r.update(row)
                return
        _local_store["playback_state"].append(row)


def load_playback_state(user_id: str) -> dict[str, Any] | None:
    if _client:
        res = _client.table("playback_state").select("state").eq(
            "user_id", user_id
        ).limit(1).execute()
        return res.data[0]["state"] if res.data else None
    for r in _local_store["playback_state"]:
        if r["user_id"] == user_id:
            return r.get("state")
    return None


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
