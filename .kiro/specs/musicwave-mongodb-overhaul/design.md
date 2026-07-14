# MusicWave MongoDB Overhaul — Bugfix Design

## Overview

This document formalizes the technical design for six interconnected bugfixes that transform MusicWave
(Musination) from a local-SQLite, Deezer-coupled, blue-themed, monolithic-page prototype into a
production-ready music streaming app backed by MongoDB Atlas, exclusively using Spotify + local CSV as
data sources, with a Spotify-green visual theme and fully distinct page components per navigation tab.

Each fix is addressed as a targeted, minimal change following the bug condition methodology:

- **Fix 1** – Replace `sqlite3` in `backend/db.py` with `pymongo` (synchronous), preserving all public
  function signatures so `main.py` requires zero import changes.
- **Fix 2** – Delete `frontend/src/api/deezer.ts`, remove Deezer endpoints from `backend/main.py`, and
  rewrite `HomePage.tsx` / `SongCard.tsx` to use the `Song` type and internal API endpoints.
- **Fix 3** – Expand `AUDIO_POOL` to 16 SoundHelix URLs, remove `previewAvailable` semantics, and strip
  all "preview" UI strings and the Deezer preview audio subsystem from `HomePage.tsx`.
- **Fix 4** – Create four new dedicated page components (`SearchPage`, `TrendingPage`, `ArtistsPage`,
  `SettingsPage`) plus a slimmed `HomePage`; wire them from `App.tsx`.
- **Fix 5** – Update `index.css` CSS variables to Spotify green and replace every hardcoded blue hex in
  all `.tsx` files.
- **Fix 6** – Remove all Deezer-branded UI strings; replace with neutral copy.


---

## Glossary

- **Bug_Condition (C)**: The set of inputs or runtime states that trigger a specific defect (see per-bug
  definitions below).
- **Property (P)**: The expected correct behaviour when the bug condition holds — i.e. what the fixed
  code must produce.
- **Preservation**: Existing correct behaviours that the fix must not regress (authentication, Spotify
  search, CSV fallback, PlayerBar, playlists, analytics).
- **F / F'**: Original (unfixed) vs. fixed implementation of a function or module.
- **pymongo**: Synchronous MongoDB driver for Python; replaces `sqlite3` in `backend/db.py`.
- **AUDIO_POOL**: List of SoundHelix MP3 URLs in `backend/main.py` used to assign a playable `audioUrl`
  to every catalog track.
- **Song (type)**: TypeScript interface in `frontend/src/types.ts` — the single canonical song shape
  used across the entire frontend after removing `DeezerTrack`.
- **isBugCondition**: Pseudocode function that returns `true` for inputs that trigger each specific bug.
- **MONGODB_URI**: Environment variable (`backend/.env`) holding the Atlas connection string.
- **Collection**: MongoDB equivalent of a SQL table; one collection per data entity.
- **`_row_to_user(doc)`**: Internal helper in `db.py` that normalises a MongoDB document into the
  standard `{ id, username, displayName, createdAt }` dict returned by public API functions.


---

## Bug Details

### Bug 1 — SQLite Persistence

#### Bug Condition

The defect activates whenever `backend/db.py` is imported and a database operation is performed using
the `sqlite3` driver against a local file path.

**Formal Specification:**
```
FUNCTION isBugCondition_DB(X)
  INPUT: X — backend runtime context
  OUTPUT: boolean

  RETURN X.db_driver = "sqlite3"
         AND X.db_path CONTAINS "musicwave.db"
END FUNCTION
```

**Examples:**
- `init_database()` calls `sqlite3.connect(DB_PATH)` → bug condition holds; should connect to Atlas.
- `create_user("alice", "pw")` writes to `musicwave.db` → data lost on redeploy.
- `list_playlists("user-123")` queries SQLite → returns empty after horizontal scale.

---

### Bug 2 — Deezer API Coupling

#### Bug Condition

The defect activates when the frontend bundle imports `deezer.ts` types or makes network requests to
`/api/deezer/*`, or when `backend/main.py` defines or calls Deezer endpoints.

**Formal Specification:**
```
FUNCTION isBugCondition_Deezer(X)
  INPUT: X — frontend module bundle OR backend route table OR network request log
  OUTPUT: boolean

  RETURN X CONTAINS_IMPORT "deezer.ts"
      OR X.route_url STARTS_WITH "/api/deezer"
      OR X CONTAINS_TYPE "DeezerTrack"
      OR X CONTAINS_FUNCTION "_fetch_deezer_tracks"
END FUNCTION
```

**Examples:**
- `HomePage.tsx` imports `{ SongCard, type DeezerTrack }` → bug holds.
- GET `/api/deezer/featured` request logged → bug holds.
- `SongCard` renders "Open on Deezer" link → bug holds.

