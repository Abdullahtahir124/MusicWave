from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
_client: MongoClient | None = None

LOCAL_DB_PATH = os.path.join(os.path.dirname(__file__), "local_db.json")

def _load_local_db() -> dict:
    if not os.path.exists(LOCAL_DB_PATH):
        return {"users": {}, "tokens": {}, "favorites": {}, "playlists": {}, "playlist_items": {}}
    try:
        with open(LOCAL_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"users": {}, "tokens": {}, "favorites": {}, "playlists": {}, "playlist_items": {}}

def _save_local_db(db_data: dict) -> None:
    try:
        with open(LOCAL_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(db_data, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        print(f"[db] Failed to save local DB: {exc}")

def _get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=1500)
    return _client["musicwave"]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return digest.hex()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(raw: Optional[str], default: Any = None) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def init_database() -> None:
    db = _get_db()
    # Create indexes
    try:
        db["users"].create_index("username", unique=True)
        db["tokens"].create_index("token", unique=True)
        db["tokens"].create_index("expires_at")
        db["recent_plays"].create_index([("user_id", ASCENDING), ("played_at", DESCENDING)])
        db["favorites"].create_index([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True)
        db["playlists"].create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        db["playlist_items"].create_index([("playlist_id", ASCENDING), ("position", ASCENDING)])
    except Exception as exc:
        print(f"[db] Index creation warning: {exc}")


# ── User helpers ─────────────────────────────────────────────────────────────

def _doc_to_user(doc: dict) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]) if "_id" in doc else doc.get("id", ""),
        "username": doc["username"],
        "displayName": doc.get("display_name", doc.get("displayName", "")),
        "createdAt": doc.get("created_at", doc.get("createdAt", "")),
    }


def create_user(username: str, password: str, display_name: Optional[str] = None) -> dict[str, Any]:
    clean_username = username.strip().lower()
    if not clean_username:
        raise ValueError("Username is required")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    user_id = secrets.token_hex(12)
    created_at = _utc_now()
    display = (display_name or clean_username.split("@")[0] or "Listener").strip() or "Listener"

    try:
        db = _get_db()
        db.client.admin.command('ping')
        db["users"].insert_one({
            "_id": user_id,
            "id": user_id,
            "username": clean_username,
            "display_name": display,
            "password_hash": password_hash,
            "password_salt": salt,
            "created_at": created_at,
        })
    except Exception as exc:
        print(f"[db] MongoDB registration failed: {exc} — using local fallback")
        local_db = _load_local_db()
        if clean_username in local_db["users"]:
            raise ValueError("Username already exists") from exc
        local_db["users"][clean_username] = {
            "id": user_id,
            "username": clean_username,
            "display_name": display,
            "password_hash": password_hash,
            "password_salt": salt,
            "created_at": created_at,
        }
        _save_local_db(local_db)

    return {
        "id": user_id,
        "username": clean_username,
        "displayName": display,
        "createdAt": created_at,
    }


def authenticate_user(username: str, password: str) -> Optional[dict[str, Any]]:
    clean_username = username.strip().lower()
    try:
        db = _get_db()
        db.client.admin.command('ping')
        doc = db["users"].find_one({"username": clean_username})
        if doc is None:
            return None
        expected = _hash_password(password, doc["password_salt"])
        if not secrets.compare_digest(expected, doc["password_hash"]):
            return None
        return _doc_to_user(doc)
    except Exception as exc:
        print(f"[db] MongoDB login failed: {exc} — using local fallback")
        local_db = _load_local_db()
        user_data = local_db["users"].get(clean_username)
        if not user_data:
            return None
        expected = _hash_password(password, user_data["password_salt"])
        if not secrets.compare_digest(expected, user_data["password_hash"]):
            return None
        return {
            "id": user_data["id"],
            "username": user_data["username"],
            "displayName": user_data["display_name"],
            "createdAt": user_data["created_at"],
        }


def get_user(user_id: str) -> Optional[dict[str, Any]]:
    try:
        db = _get_db()
        db.client.admin.command('ping')
        doc = db["users"].find_one({"_id": user_id})
        return _doc_to_user(doc) if doc else None
    except Exception:
        local_db = _load_local_db()
        for u_data in local_db["users"].values():
            if u_data["id"] == user_id:
                return {
                    "id": u_data["id"],
                    "username": u_data["username"],
                    "displayName": u_data["display_name"],
                    "createdAt": u_data["created_at"],
                }
        return None


def issue_token(user_id: str, ttl_days: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    now = _utc_now()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
    try:
        db = _get_db()
        db.client.admin.command('ping')
        db["tokens"].insert_one({
            "token": token,
            "user_id": user_id,
            "created_at": now,
            "expires_at": expires_at,
        })
    except Exception as exc:
        print(f"[db] MongoDB token issue failed: {exc} — using local fallback")
        local_db = _load_local_db()
        local_db["tokens"][token] = {
            "token": token,
            "user_id": user_id,
            "created_at": now,
            "expires_at": expires_at,
        }
        _save_local_db(local_db)
    return token


def revoke_token(token: str) -> None:
    try:
        db = _get_db()
        db["tokens"].delete_one({"token": token})
    except Exception:
        local_db = _load_local_db()
        if token in local_db["tokens"]:
            del local_db["tokens"][token]
            _save_local_db(local_db)


def get_user_by_token(token: str) -> Optional[dict[str, Any]]:
    now = _utc_now()
    try:
        db = _get_db()
        db.client.admin.command('ping')
        tok_doc = db["tokens"].find_one({"token": token, "expires_at": {"$gt": now}})
        if tok_doc is None:
            return None
        user_doc = db["users"].find_one({"_id": tok_doc["user_id"]})
        return _doc_to_user(user_doc) if user_doc else None
    except Exception as exc:
        print(f"[db] MongoDB token verification failed: {exc} — using local fallback")
        local_db = _load_local_db()
        tok_data = local_db["tokens"].get(token)
        if not tok_data or tok_data["expires_at"] <= now:
            return None
        user_id = tok_data["user_id"]
        for u_data in local_db["users"].values():
            if u_data["id"] == user_id:
                return {
                    "id": u_data["id"],
                    "username": u_data["username"],
                    "displayName": u_data["display_name"],
                    "createdAt": u_data["created_at"],
                }
        return None


# ── Song helpers ─────────────────────────────────────────────────────────────

def _serialize_song(song: Any) -> dict[str, Any]:
    if isinstance(song, dict):
        return song
    if hasattr(song, "model_dump"):
        return song.model_dump()
    if hasattr(song, "dict"):
        return song.dict()
    raise TypeError("Unsupported song payload")


# ── Recent plays ─────────────────────────────────────────────────────────────

def record_recent_play(user_id: str, song: Any, limit: int = 50) -> None:
    song_doc = _serialize_song(song)
    song_id = song_doc.get("id") or getattr(song, "id", None)
    if not song_id:
        return
    db = _get_db()
    db["recent_plays"].insert_one({
        "user_id": user_id,
        "song_id": str(song_id),
        "song": song_doc,
        "played_at": _utc_now(),
    })
    # Trim to limit — keep most recent
    cursor = db["recent_plays"].find(
        {"user_id": user_id},
        sort=[("played_at", DESCENDING)]
    ).skip(limit)
    ids_to_delete = [d["_id"] for d in cursor]
    if ids_to_delete:
        db["recent_plays"].delete_many({"_id": {"$in": ids_to_delete}})


def list_recent_plays(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    db = _get_db()
    docs = db["recent_plays"].find(
        {"user_id": user_id},
        sort=[("played_at", DESCENDING)]
    ).limit(limit)
    return [d["song"] for d in docs]


# ── Favorites ─────────────────────────────────────────────────────────────────

def toggle_favorite(user_id: str, song: Any) -> dict[str, Any]:
    song_doc = _serialize_song(song)
    song_id = song_doc.get("id") or getattr(song, "id", None)
    if not song_id:
        raise ValueError("Song id is required")
    db = _get_db()
    existing = db["favorites"].find_one({"user_id": user_id, "song_id": str(song_id)})
    if existing:
        db["favorites"].delete_one({"user_id": user_id, "song_id": str(song_id)})
        return {"liked": False}
    db["favorites"].insert_one({
        "user_id": user_id,
        "song_id": str(song_id),
        "song": song_doc,
        "created_at": _utc_now(),
    })
    return {"liked": True}


def list_favorites(user_id: str) -> list[dict[str, Any]]:
    db = _get_db()
    docs = db["favorites"].find(
        {"user_id": user_id},
        sort=[("created_at", DESCENDING)]
    )
    return [d["song"] for d in docs]


# ── Playlists ─────────────────────────────────────────────────────────────────

def _playlist_tracks(db, playlist_id: str) -> list[dict[str, Any]]:
    docs = db["playlist_items"].find(
        {"playlist_id": playlist_id},
        sort=[("position", ASCENDING)]
    )
    return [d["song"] for d in docs]


def _doc_to_playlist(doc: dict, tracks: list) -> dict[str, Any]:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "description": doc.get("description", ""),
        "isCollaborative": bool(doc.get("is_collaborative", False)),
        "createdAt": doc.get("created_at", ""),
        "updatedAt": doc.get("updated_at", ""),
        "tracks": tracks,
    }


def create_playlist(user_id: str, name: str, description: str = "", collaborative: bool = False) -> dict[str, Any]:
    playlist_id = secrets.token_hex(12)
    now = _utc_now()
    doc = {
        "_id": playlist_id,
        "id": playlist_id,
        "user_id": user_id,
        "name": name.strip() or "Untitled Playlist",
        "description": description.strip(),
        "is_collaborative": bool(collaborative),
        "created_at": now,
        "updated_at": now,
    }
    db = _get_db()
    db["playlists"].insert_one(doc)
    return _doc_to_playlist(doc, [])


def list_playlists(user_id: str) -> list[dict[str, Any]]:
    db = _get_db()
    docs = db["playlists"].find(
        {"user_id": user_id},
        sort=[("updated_at", DESCENDING)]
    )
    return [_doc_to_playlist(d, _playlist_tracks(db, d["id"])) for d in docs]


def get_playlist(user_id: str, playlist_id: str) -> Optional[dict[str, Any]]:
    db = _get_db()
    doc = db["playlists"].find_one({"id": playlist_id, "user_id": user_id})
    if doc is None:
        return None
    return _doc_to_playlist(doc, _playlist_tracks(db, playlist_id))


def update_playlist(
    user_id: str,
    playlist_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    collaborative: Optional[bool] = None,
) -> Optional[dict[str, Any]]:
    updates: dict[str, Any] = {"updated_at": _utc_now()}
    if name is not None:
        updates["name"] = name.strip() or "Untitled Playlist"
    if description is not None:
        updates["description"] = description.strip()
    if collaborative is not None:
        updates["is_collaborative"] = bool(collaborative)
    db = _get_db()
    db["playlists"].update_one({"id": playlist_id, "user_id": user_id}, {"$set": updates})
    return get_playlist(user_id, playlist_id)


def delete_playlist(user_id: str, playlist_id: str) -> bool:
    db = _get_db()
    result = db["playlists"].delete_one({"id": playlist_id, "user_id": user_id})
    if result.deleted_count > 0:
        db["playlist_items"].delete_many({"playlist_id": playlist_id})
        return True
    return False


def add_song_to_playlist(user_id: str, playlist_id: str, song: Any) -> Optional[dict[str, Any]]:
    song_doc = _serialize_song(song)
    db = _get_db()
    if not db["playlists"].find_one({"id": playlist_id, "user_id": user_id}):
        return None
    last = db["playlist_items"].find_one(
        {"playlist_id": playlist_id},
        sort=[("position", DESCENDING)]
    )
    next_pos = (last["position"] + 1) if last else 1
    db["playlist_items"].insert_one({
        "playlist_id": playlist_id,
        "position": next_pos,
        "song": song_doc,
        "added_at": _utc_now(),
    })
    db["playlists"].update_one({"id": playlist_id}, {"$set": {"updated_at": _utc_now()}})
    return get_playlist(user_id, playlist_id)


def remove_song_from_playlist(user_id: str, playlist_id: str, song_id: str) -> Optional[dict[str, Any]]:
    db = _get_db()
    if not db["playlists"].find_one({"id": playlist_id, "user_id": user_id}):
        return None
    db["playlist_items"].delete_many({"playlist_id": playlist_id, "song.id": song_id})
    db["playlists"].update_one({"id": playlist_id}, {"$set": {"updated_at": _utc_now()}})
    return get_playlist(user_id, playlist_id)


def reorder_playlist_track(user_id: str, playlist_id: str, song_id: str, position: int) -> Optional[dict[str, Any]]:
    db = _get_db()
    if not db["playlists"].find_one({"id": playlist_id, "user_id": user_id}):
        return None
    items = list(db["playlist_items"].find(
        {"playlist_id": playlist_id},
        sort=[("position", ASCENDING)]
    ))
    moving = next((i for i in items if i.get("song", {}).get("id") == song_id), None)
    if moving is None:
        return get_playlist(user_id, playlist_id)
    rest = [i for i in items if i.get("song", {}).get("id") != song_id]
    insert_at = max(0, min(position, len(rest)))
    rest.insert(insert_at, moving)
    for idx, item in enumerate(rest, start=1):
        db["playlist_items"].update_one({"_id": item["_id"]}, {"$set": {"position": idx}})
    db["playlists"].update_one({"id": playlist_id}, {"$set": {"updated_at": _utc_now()}})
    return get_playlist(user_id, playlist_id)


def export_playlists(user_id: str) -> list[dict[str, Any]]:
    return list_playlists(user_id)


def import_playlists(user_id: str, playlists: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
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


# ── Analytics ─────────────────────────────────────────────────────────────────

def analytics_summary(user_id: str) -> dict[str, Any]:
    db = _get_db()
    favorites_count = db["favorites"].count_documents({"user_id": user_id})
    playlists_count = db["playlists"].count_documents({"user_id": user_id})
    recent_count = db["recent_plays"].count_documents({"user_id": user_id})
    events_count = db["analytics_events"].count_documents({"user_id": user_id})
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$song_id", "song": {"$first": "$song"}, "plays": {"$sum": 1}}},
        {"$sort": {"plays": -1}},
        {"$limit": 5},
    ]
    top_docs = list(db["recent_plays"].aggregate(pipeline))
    return {
        "favoritesCount": int(favorites_count),
        "playlistsCount": int(playlists_count),
        "recentPlaysCount": int(recent_count),
        "eventCount": int(events_count),
        "topTracks": [d["song"] for d in top_docs],
    }


# ── Playback state ────────────────────────────────────────────────────────────

def save_playback_state(user_id: str, state: dict[str, Any]) -> None:
    db = _get_db()
    db["playback_state"].update_one(
        {"user_id": user_id},
        {"$set": {"state": state, "updated_at": _utc_now()}},
        upsert=True,
    )


def load_playback_state(user_id: str) -> dict[str, Any] | None:
    db = _get_db()
    doc = db["playback_state"].find_one({"user_id": user_id})
    return doc["state"] if doc else None
