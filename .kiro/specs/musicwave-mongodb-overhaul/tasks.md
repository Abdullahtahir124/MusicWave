# MusicWave MongoDB Overhaul — Implementation Tasks

## Task Overview
Six targeted bugfixes: MongoDB migration, Deezer removal, full-audio playback, distinct pages, Spotify-green theme, and clean UI messaging.

---

## Tasks

- [x] 1. Migrate backend database from SQLite to MongoDB
  - Replace `backend/db.py`: remove all `sqlite3` imports and `DB_PATH`; add `pymongo` with Atlas URI from env
  - Keep all public function signatures identical (`init_database`, `create_user`, `authenticate_user`, `get_user_by_token`, `issue_token`, `revoke_token`, `create_playlist`, `list_playlists`, `get_playlist`, `update_playlist`, `delete_playlist`, `add_song_to_playlist`, `remove_song_from_playlist`, `reorder_playlist_track`, `toggle_favorite`, `list_favorites`, `record_recent_play`, `list_recent_plays`, `save_playback_state`, `load_playback_state`, `export_playlists`, `import_playlists`, `analytics_summary`)
  - Add `pymongo[srv]==4.6.3` and `dnspython==2.6.1` to `backend/requirements.txt`
  - Write `MONGODB_URI` to `backend/.env` using the provided Atlas connection string
  - `init_database()` must create indexes: `users.username` unique, `tokens.token` unique, `tokens.expires_at` TTL
  - Files: `backend/db.py`, `backend/requirements.txt`, `backend/.env`

- [x] 2. Remove all Deezer references from backend
  - Delete the `_fetch_deezer_tracks` function from `backend/main.py`
  - Remove the `/api/deezer/featured` and `/api/deezer/search` route handlers from `backend/main.py`
  - Add a `/api/featured` endpoint that returns 12 tracks from the local CSV catalog (using `_get_df()` and `_row_to_song_payload`)
  - Ensure all SoundHelix audioUrl fallbacks are always set (never null) in `_track_to_song` and `_row_to_song_payload`
  - Files: `backend/main.py`

- [x] 3. Remove all Deezer references from frontend
  - Delete `frontend/src/api/deezer.ts`
  - Rewrite `frontend/src/components/SongCard.tsx` to accept `Song` type (from `../types`) instead of `DeezerTrack`; remove "Open on Deezer" link, "Preview unavailable" badges, and all Deezer references
  - Files: `frontend/src/api/deezer.ts` (delete), `frontend/src/components/SongCard.tsx`

- [ ] 4. Apply Spotify-green theme globally
  - In `frontend/src/index.css`: change `--accent` to `#1DB954`, `--accent-light` to `#1ed760`, `--accent-dark` to `#158a3e`; change background vars `--bg-deep` to `#121212`, `--bg-base` to `#181818`, `--bg-surface` to `#282828`, `--bg-card` to `rgba(40,40,40,0.85)`; replace all hardcoded `#3B82F6`, `#60A5FA`, `#1D4ED8` color values with Spotify green equivalents; update scrollbar, focus rings, `.musify-nav-item::before`, `.eq-bar`, `.hero-controls .primary`, `.skeleton`, `.ripple-container .ripple`, `.music-card`, `.nav-item::before` to use `#1DB954`
  - Files: `frontend/src/index.css`

- [ ] 5. Apply Spotify-green theme to all components
  - In `frontend/src/App.tsx`: replace `ACCENT = '#3B82F6'` with `'#1DB954'`, `ACCENT_GLOW` with `rgba(29,185,84,0.55)`, all navy backgrounds with `#121212`/`#181818`, all blue rgba colors with green equivalents; update brand name highlight color
  - In `frontend/src/components/PlayerBar.tsx`: replace all `#3B82F6`/`#60A5FA`/`rgba(59,130,246,...)` with Spotify green equivalents
  - Files: `frontend/src/App.tsx`, `frontend/src/components/PlayerBar.tsx`

- [ ] 6. Create dedicated SearchPage component
  - Create `frontend/src/pages/SearchPage.tsx` as a fully distinct page with: large hero search bar, genre/mood filter chips (Pop, Hip-Hop, Rock, Electronic, Jazz, Classical, R&B, Latin), real-time results grid calling `/api/search?q=` with debounce, trending searches section showing static popular queries, empty state, loading spinner (no Deezer text), error state with generic message
  - Each result card shows cover art, title, artist, duration, play button that calls `playSong()` from `useAudio()`
  - Files: `frontend/src/pages/SearchPage.tsx`

- [ ] 7. Create dedicated TrendingPage component
  - Create `frontend/src/pages/TrendingPage.tsx` with: numbered chart list (#1-#20) using the local SONGS catalog + `/api/featured` data, "This Week's Hits" section, genre breakdown with colored bars, trending artists row
  - Each row shows rank number, cover art, title, artist, play count (static), trend arrow, play button
  - Files: `frontend/src/pages/TrendingPage.tsx`

- [ ] 8. Create dedicated ArtistsPage component
  - Create `frontend/src/pages/ArtistsPage.tsx` with: grid of artist cards (name, image, follower count, genre tag), click to open artist detail panel showing top tracks for that artist filtered from the local catalog, "Follow" toggle button per artist
  - Files: `frontend/src/pages/ArtistsPage.tsx`

- [ ] 9. Create dedicated SettingsPage component
  - Create `frontend/src/pages/SettingsPage.tsx` with distinct sections: Profile (display name, avatar placeholder), Playback (auto-play toggle, crossfade toggle, audio quality selector), Appearance (theme toggle placeholder, language selector), Account (change password placeholder, logout button), Notifications (toggle switches)
  - Use Spotify-style grouped list items with section headers
  - Files: `frontend/src/pages/SettingsPage.tsx`

- [ ] 10. Rebuild HomePage as dedicated home-only component and rewrite App.tsx routing
  - Rewrite `frontend/src/pages/HomePage.tsx` to be home-only: Spotify-style hero banner with currently playing song, "Recently Played" horizontal scroll row, "Featured Tracks" grid (calls `/api/featured`), "Made For You" mood-category grid, "New Releases" section — no `view` prop, no artists/search/settings/trending rendering
  - Remove all Deezer imports, `DeezerTrack` types, `fetchFeaturedTracks`, `searchTracks` calls, "Searching Deezer" text, "Deezer chart picks" labels from HomePage
  - Rewrite `frontend/src/App.tsx` routing: replace the single `tab !== 'library' ? <HomePage view={tab} /> : <LibraryPage />` with a proper switch: `home` → `<HomePage />`, `search` → `<SearchPage />`, `trending` → `<TrendingPage />`, `artists` → `<ArtistsPage />`, `settings` → `<SettingsPage />`, `library` → `<LibraryPage />`
  - Files: `frontend/src/pages/HomePage.tsx`, `frontend/src/App.tsx`

- [ ] 11. Enhance LibraryPage (PlaylistPage)
  - Rewrite `frontend/src/pages/LibraryPage.tsx` with: Spotify-green themed tabs, playlist creation modal (name + description input), playlist cards with gradient art, full playlist detail view with track list, "Add to Playlist" dropdown on each song row, drag handle visual (no actual DnD library required — just visual reorder arrows), empty states with green accent
  - Files: `frontend/src/pages/LibraryPage.tsx`

- [ ] 12. Final integration: verify build and fix remaining issues
  - Run `npm run build` in `frontend/` and fix any TypeScript errors
  - Ensure `backend/requirements.txt` has all needed packages and `backend/.env` has `MONGODB_URI`
  - Remove `frontend/src/api/deezer.ts` if still present
  - Verify no `#3B82F6` remains in any `.tsx` or `.css` file
  - Verify no "Deezer" string appears in any user-facing component
  - Files: any files with remaining issues
