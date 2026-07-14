# Bugfix Requirements Document

## Introduction

MusicWave (Musination) is a music streaming web app built on FastAPI (backend) and React + TypeScript (frontend). Six interconnected defects currently prevent the app from functioning as a polished, production-quality product:

1. **SQLite persistence** — all user data is stored in a local SQLite file (`backend/musicwave.db`) instead of the intended MongoDB cluster, making the app non-portable and unsuitable for multi-user/cloud deployment.
2. **Deezer API coupling** — the app imports and calls the Deezer API (`/api/deezer/*`, `frontend/src/api/deezer.ts`, `SongCard` with `DeezerTrack` type) even though Spotify + local CSV are the intended data sources, polluting the UI with "Searching Deezer…" and "Deezer chart picks" labels and causing errors when Deezer is unavailable.
3. **30-second audio previews** — songs are served as 30-second Spotify preview clips or short SoundHelix samples labelled `previewAvailable: true`; the app should treat SoundHelix MP3s as full-length audio and remove all preview-only messaging.
4. **Monolithic page component** — `HomePage` renders every view (`home`, `search`, `trending`, `artists`, `settings`) as near-identical panels inside one component; each navigation destination must be a fully distinct, purpose-built page.
5. **Blue-themed UI** — the entire app uses a blue accent (`#3B82F6`) that conflicts with the target Spotify-inspired aesthetic; the correct palette is Spotify green (`#1DB954`) on deep black backgrounds.
6. **Visible Deezer/error messaging** — UI strings such as "Searching Deezer…", "Deezer chart picks", and error banners referencing Deezer surface directly to users.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — SQLite Database**

1.1 WHEN the backend starts THEN the system initialises a SQLite database at `backend/musicwave.db` via `backend/db.py` instead of connecting to MongoDB

1.2 WHEN a user registers, logs in, creates a playlist, toggles a favorite, records a recent play, or saves playback state THEN the system persists that data to the local SQLite file using `sqlite3` connections

1.3 WHEN the app is deployed to a server or cloud environment THEN the system loses all user data because the SQLite file is not shared across instances

**Bug 2 — Deezer API Coupling**

2.1 WHEN the app loads the home/search view THEN the system calls `fetchFeaturedTracks()` and `searchTracks()` from `frontend/src/api/deezer.ts`, which proxies through `/api/deezer/featured` and `/api/deezer/search` on the backend

2.2 WHEN a Deezer API call is in progress THEN the system displays the text "Searching Deezer…" in the UI

2.3 WHEN featured tracks load successfully THEN the system labels the section "Deezer chart picks"

2.4 WHEN the user views a song card THEN the system renders a `DeezerTrack`-typed card (from `SongCard.tsx`) with an "Open on Deezer" external link

2.5 WHEN `HomePage.tsx` is compiled THEN the system imports `SongCard`, `DeezerTrack`, `fetchFeaturedTracks`, `searchTracks`, and `DeezerTrackApiResponse` from Deezer modules

**Bug 3 — 30-Second Preview Audio**

3.1 WHEN a song is resolved from the local catalog THEN the system assigns `previewAvailable: true` and an `audioUrl` pointing to a SoundHelix sample or a Spotify 30-second `preview_url`

3.2 WHEN a Spotify-sourced track has no `preview_url` THEN the system sets `audioUrl: null` and `previewAvailable: false`, leaving those tracks unplayable

3.3 WHEN a Deezer-sourced track is displayed THEN the system shows "Preview unavailable" badges and "Preview started. Select a full track to play complete songs." toast messages

**Bug 4 — Monolithic Page Component**

4.1 WHEN the user navigates to `search` via the sidebar THEN the system renders the same `HomePage` component with a `view="search"` prop, showing only a minor layout variation instead of a dedicated search page

4.2 WHEN the user navigates to `trending` THEN the system renders `HomePage` with `view="trending"`, filtering the same static `SONGS` array rather than presenting a proper charts/ranking page

4.3 WHEN the user navigates to `artists` THEN the system renders a basic five-card grid inside `HomePage` with no artist detail views, follower counts, or top-track listings

4.4 WHEN the user navigates to `settings` THEN the system renders a four-item list of toggle rows inside `HomePage` with no profile management, theme toggle, or audio quality controls

4.5 WHEN the user navigates to `library` (Playlist) THEN the system renders `LibraryPage` with basic tab switching but no drag-to-reorder, playlist art, or full playlist management UI

**Bug 5 — Blue-Themed UI**

5.1 WHEN any page or component is rendered THEN the system applies the blue accent color `#3B82F6` as the primary brand color across all interactive elements, the sidebar active indicator, hero play button glow, waveform highlights, and skeleton shimmer

5.2 WHEN CSS variables are evaluated THEN the system uses `--accent: #3B82F6`, `--accent-light: #60A5FA`, `--accent-dark: #1D4ED8` with deep-navy backgrounds (`#05080F`, `#0A0E1A`, `#0D1117`)

5.3 WHEN the brand name is displayed THEN the system renders "Musi**nation**" with the suffix highlighted in blue (`#3B82F6`)

**Bug 6 — Visible Deezer/Error Messaging**

6.1 WHEN a Deezer search is in progress THEN the system displays the literal string "Searching Deezer…" inside a loading spinner panel

6.2 WHEN featured tracks are shown without a search query THEN the system displays "Deezer chart picks" as the section subtitle

6.3 WHEN a Deezer API call fails THEN the system surfaces error messages referencing Deezer directly to the user

---

### Expected Behavior (Correct)

**Bug 1 — MongoDB Migration**

2.1 WHEN the backend starts THEN the system SHALL connect to MongoDB using the configured Atlas connection string and initialise all collections (`users`, `tokens`, `playlists`, `playlist_items`, `favorites`, `recent_plays`, `playback_state`, `analytics_events`)

2.2 WHEN a user registers, logs in, creates a playlist, toggles a favorite, records a recent play, or saves playback state THEN the system SHALL persist and retrieve that data from MongoDB documents using `motor` or `pymongo`

2.3 WHEN the app is deployed to any environment with network access to the MongoDB Atlas cluster THEN the system SHALL maintain full data persistence across all instances

**Bug 2 — Deezer Removal**

2.1 WHEN the app loads the home/search view THEN the system SHALL fetch featured and search results exclusively through the existing Spotify (`/api/search`) and local CSV endpoints — no Deezer calls SHALL be made

2.2 WHEN a search is in progress THEN the system SHALL display a generic "Searching…" or "Loading…" indicator with no reference to Deezer

2.3 WHEN featured tracks load THEN the system SHALL label the section with a neutral title (e.g. "Featured Tracks" or "Trending Now") with no Deezer branding

2.4 WHEN a song card is displayed THEN the system SHALL render a generic `Song`-typed card with no "Open on Deezer" link and no `DeezerTrack` type dependency

2.5 WHEN `HomePage.tsx` is compiled THEN the system SHALL contain no imports from `deezer.ts` or any `DeezerTrack`/`DeezerTrackApiResponse` references

**Bug 3 — Full-Length Audio**

3.1 WHEN a song is resolved from the local catalog THEN the system SHALL assign a SoundHelix MP3 URL as `audioUrl` and treat it as a full-length track (no `previewAvailable` flag limiting playback)

3.2 WHEN a Spotify-sourced track has no `preview_url` THEN the system SHALL fall back to a SoundHelix URL from `AUDIO_POOL` so that every track in the catalog is playable

3.3 WHEN any track is displayed THEN the system SHALL show no "Preview unavailable", "30-second preview", or "Select a full track" messaging

**Bug 4 — Distinct Pages**

4.1 WHEN the user navigates to `search` THEN the system SHALL render a dedicated `SearchPage` component with a prominent search bar, genre/mood filter chips, a real-time results grid, and trending searches

4.2 WHEN the user navigates to `trending` THEN the system SHALL render a dedicated `TrendingPage` component with a numbered chart ranking list, trending tracks this week, and genre breakdown

4.3 WHEN the user navigates to `artists` THEN the system SHALL render a dedicated `ArtistsPage` component with artist cards showing follower counts, top tracks per artist, and an artist detail view

4.4 WHEN the user navigates to `settings` THEN the system SHALL render a dedicated `SettingsPage` component with profile settings, audio quality selection, theme toggle, account management, and notification preferences

4.5 WHEN the user navigates to `home` THEN the system SHALL render a dedicated `HomePage` (home-only) component with a Spotify-style hero banner, featured playlists grid, recently played row, new releases section, and mood-based categories

4.6 WHEN the user navigates to `library` (Playlist) THEN the system SHALL render an enhanced `PlaylistPage` component supporting create, rename, delete, add/remove tracks, drag-to-reorder, and playlist art

**Bug 5 — Spotify-Green Theme**

5.1 WHEN any page or component is rendered THEN the system SHALL apply the Spotify green accent `#1DB954` as the primary brand color across all interactive elements, active indicators, play button glows, and highlights

5.2 WHEN CSS variables are evaluated THEN the system SHALL use `--accent: #1DB954` with deep black backgrounds (`#121212`, `#181818`, `#282828`) matching Spotify's design language

5.3 WHEN the brand name is displayed THEN the system SHALL render it with the accent portion highlighted in Spotify green (`#1DB954`)

**Bug 6 — Clean UI Messaging**

6.1 WHEN a search is in progress THEN the system SHALL display a neutral loading indicator with no Deezer-specific text

6.2 WHEN featured tracks are shown THEN the system SHALL display a neutral section label with no Deezer branding

6.3 WHEN any API error occurs THEN the system SHALL surface a user-friendly message that does not expose third-party service names or technical error details to the user

---

### Unchanged Behavior (Regression Prevention)

**Authentication & User Management**

3.1 WHEN a user submits valid credentials on the login page THEN the system SHALL CONTINUE TO authenticate and return a JWT-like token via `/api/auth/login`

3.2 WHEN a new user submits valid registration data THEN the system SHALL CONTINUE TO create an account via `/api/auth/register` with PBKDF2-hashed passwords

3.3 WHEN a logged-in user calls `/api/me` with a valid Bearer token THEN the system SHALL CONTINUE TO return the authenticated user's profile

3.4 WHEN a user logs out THEN the system SHALL CONTINUE TO revoke the session token via `/api/auth/logout`

**Spotify API Integration**

3.5 WHEN Spotify credentials are configured THEN the system SHALL CONTINUE TO obtain a cached client-credentials token via `_get_token()` and refresh it before expiry

3.6 WHEN the user searches with a query of 2+ characters THEN the system SHALL CONTINUE TO query the Spotify search API and return up to 20 tracks via `/api/search`

3.7 WHEN track recommendations are requested via `/api/recommend` THEN the system SHALL CONTINUE TO compute cosine similarity from Spotify audio features and return ranked results

3.8 WHEN a specific track is requested via `/api/track/{track_id}` THEN the system SHALL CONTINUE TO return full track details including audio features from Spotify

**Local CSV Fallback**

3.9 WHEN Spotify credentials are absent or the Spotify API call fails THEN the system SHALL CONTINUE TO fall back to the local CSV dataset via `src/data_loader.get_clean_data()` and `src/recommender.recommend_songs()`

3.10 WHEN the local CSV fallback is used for search THEN the system SHALL CONTINUE TO filter rows by title, artist, album, genre, and duration bounds

**PlayerBar & Audio Playback**

3.11 WHEN the user clicks play on any song THEN the system SHALL CONTINUE TO update `AudioContext` state and begin playback via the `PlayerBar` component

3.12 WHEN the user interacts with the PlayerBar (play/pause, skip, seek, volume) THEN the system SHALL CONTINUE TO control audio playback without interruption

3.13 WHEN the user plays a song THEN the system SHALL CONTINUE TO record it in recent plays and update the "Recently Played" sidebar section

**Playlist & Library Operations**

3.14 WHEN the user creates a playlist THEN the system SHALL CONTINUE TO persist it and return it via `/api/playlists`

3.15 WHEN the user adds or removes a track from a playlist THEN the system SHALL CONTINUE TO update the playlist via the existing track management endpoints

3.16 WHEN the user toggles a favorite THEN the system SHALL CONTINUE TO toggle the liked state and persist it

3.17 WHEN the user exports playlists THEN the system SHALL CONTINUE TO return the full playlist structure via `/api/playlists/export`

**Analytics**

3.18 WHEN the user views stats THEN the system SHALL CONTINUE TO return favorites count, playlists count, recent plays count, event count, and top tracks via `/api/analytics/summary`

**Advanced Search**

3.19 WHEN the user uses advanced search with artist, album, genre, mood, or duration filters THEN the system SHALL CONTINUE TO apply those filters via `/api/search/advanced`

**API Health Check**

3.20 WHEN `/api/health` is called THEN the system SHALL CONTINUE TO return `{ "status": "ok", "spotify": <bool> }` reflecting Spotify connectivity

---

## Bug Condition Pseudocode

### Bug 1 — SQLite vs MongoDB

```pascal
FUNCTION isBugCondition_DB(X)
  INPUT: X — backend runtime context
  OUTPUT: boolean
  RETURN X.db_driver = "sqlite3" AND X.db_path CONTAINS "musicwave.db"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_DB(X) DO
  result ← init_database'(X)
  ASSERT result.db_driver = "motor" OR result.db_driver = "pymongo"
  ASSERT result.connection_string CONTAINS "mongodb+srv"
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_DB(X) DO
  ASSERT F(X).user_ops = F'(X).user_ops  // CRUD behavior unchanged
END FOR
```

### Bug 2 — Deezer Removal

```pascal
FUNCTION isBugCondition_Deezer(X)
  INPUT: X — frontend module bundle or network request
  OUTPUT: boolean
  RETURN X CONTAINS_IMPORT "deezer.ts"
      OR X.request_url CONTAINS "/api/deezer"
      OR X CONTAINS_TYPE "DeezerTrack"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_Deezer(X) DO
  result ← build'(X)
  ASSERT result NOT_CONTAINS_IMPORT "deezer.ts"
  ASSERT result.network_calls NOT_CONTAINS "/api/deezer"
END FOR
```

### Bug 3 — Preview Audio

```pascal
FUNCTION isBugCondition_Preview(X)
  INPUT: X — Song object
  OUTPUT: boolean
  RETURN X.audioUrl = null
      OR X.previewAvailable = false
      OR X.ui_label CONTAINS "30-second"
      OR X.ui_label CONTAINS "Preview unavailable"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_Preview(X) DO
  result ← resolveSong'(X)
  ASSERT result.audioUrl IS_NOT null
  ASSERT result.ui CONTAINS_NO "preview" messaging
END FOR
```

### Bug 4 — Monolithic Page

```pascal
FUNCTION isBugCondition_Page(X)
  INPUT: X — navigation event with target view
  OUTPUT: boolean
  RETURN X.target IN {"search","trending","artists","settings"}
      AND X.rendered_component = "HomePage"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_Page(X) DO
  result ← navigate'(X)
  ASSERT result.rendered_component ≠ "HomePage"
  ASSERT result.rendered_component IS dedicated page for X.target
END FOR
```

### Bug 5 — Blue Theme

```pascal
FUNCTION isBugCondition_Theme(X)
  INPUT: X — rendered CSS / component style
  OUTPUT: boolean
  RETURN X.accent_color = "#3B82F6"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_Theme(X) DO
  result ← applyTheme'(X)
  ASSERT result.accent_color = "#1DB954"
  ASSERT result.bg_color IN {"#121212", "#181818", "#282828"}
END FOR
```

### Bug 6 — Deezer UI Text

```pascal
FUNCTION isBugCondition_UIText(X)
  INPUT: X — rendered UI string
  OUTPUT: boolean
  RETURN X CONTAINS "Searching Deezer"
      OR X CONTAINS "Deezer chart picks"
      OR X CONTAINS "Open on Deezer"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_UIText(X) DO
  result ← render'(X)
  ASSERT result NOT_CONTAINS "Deezer"
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_UIText(X) DO
  ASSERT F(X).loading_states = F'(X).loading_states
  ASSERT F(X).error_messages_shown = F'(X).error_messages_shown
END FOR
```
