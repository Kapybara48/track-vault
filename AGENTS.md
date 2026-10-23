# Track Vault - Agent Memory & Project Instructions

This document preserves persistent context, architectural conventions, recent changes, and operational guidelines across AI pair programming sessions.

---

## 1. Project Overview

- **Name:** Track Vault
- **Repository:** `Kapybara48/track-vault`
- **Stack:**
  - **Framework:** SvelteKit 5 (Svelte 5 Runes: `$state`, `$derived`, `$props`)
  - **Language:** TypeScript
  - **Database:** SQLite via `better-sqlite3` (WAL mode enabled, foreign keys ON)
  - **Styling:** TailwindCSS v4
  - **Metadata:** `music-metadata` for audio tags & format extraction
  - **Icons:** `@lucide/svelte`
  - **Container:** Docker + Docker Compose with `@sveltejs/adapter-node`

---

## 2. Architecture & Conventions

### Database & Migrations (`src/lib/server/db.ts`)
- Path defaults to `./data/trackvault.db` or `DATA_DIR` env variable.
- Uses `better-sqlite3` synchronously.
- **Migrations:** Always verify schema column existence with `PRAGMA table_info(table)` before running `ALTER TABLE ... ADD COLUMN` so that unexpected database errors (permission, disk space, lock) are not silently swallowed.
- **Indices:** Use `CREATE INDEX IF NOT EXISTS` natively without empty try/catch wrappers.

### Authentication & Sessions (`src/lib/server/auth.ts`)
- Cryptographic scrypt password hashing with unique 16-byte salts and `crypto.timingSafeEqual`.
- Sessions stored in SQLite `sessions` table (32-byte hex tokens, 30-day lifetime).
- Centralized cookie helper `getSessionCookieOptions(url)` in [`src/lib/server/auth.ts`](file:///mnt/data/Projects/track-vault/src/lib/server/auth.ts):
  - Cookie name: `SESSION_COOKIE_NAME = 'vault_session'`.
  - Flags: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 30 days`.
  - Dynamic `secure` flag: Enabled if `COOKIE_SECURE=true`, protocol is `https:`, or running in `production`.
- `AUTH_DISABLED=true` (or `DISABLE_AUTH=true`) assigns synthetic admin user `{ id: 1, username: 'admin', role: 'admin' }` and emits a high-visibility warning to the console on startup.

### Album & Track Fixer Rules
- Fixer rules (`FixerRules`) flag tracks for quality, audio format (lossy / mp3), censorship, and lyrics status.
- [`updateAlbumFixerRules(albumId, rules, applyToAll)`](file:///mnt/data/Projects/track-vault/src/lib/server/db.ts) returns `{ album, tracks } | null`. If the album ID does not exist, it returns `null`, and the API endpoint ([`src/routes/api/albums/[id]/fixer-rules/+server.ts`](file:///mnt/data/Projects/track-vault/src/routes/api/albums/[id]/fixer-rules/+server.ts)) responds with HTTP `404 Not Found`.

---

## 3. Session Memory & Change History

### Recent Fixes & Additions (2026-10-23)
1. **`updateAlbumFixerRules` return type**: Validated album existence before updating and updated return type to `{ album: Album; tracks: Track[] } | null`. Endpoint now returns 404 if album not found.
2. **Database migration safety**: Replaced empty `try/catch` migration statements with `PRAGMA table_info` checks.
3. **Session cookie unification**: Unified cookie handling across API endpoints (`/api/auth/login`, `/api/auth/setup`, `/api/auth/logout`) and form actions (`/login`, `/setup`) using `SESSION_COOKIE_NAME` and `getSessionCookieOptions(url)`.
4. **Auth disable logging**: Added loud console warning when authentication is bypassed via `AUTH_DISABLED=true`.
5. **Account Settings & Password Change**:
   - Added `/settings` page (`src/routes/settings/+page.svelte` & `+page.server.ts`) for managing account credentials and viewing system stats.
   - Added `changePassword` in `src/lib/server/auth.ts` with current password verification and 6+ character validation.
   - Added API endpoint `POST /api/auth/change-password`.
   - Added Settings link & user profile shortcut to desktop and mobile navigation in `src/lib/components/Navbar.svelte`.
6. **Defensive Password Verification (`verifyPassword`)**: Added length validation and try/catch around `crypto.timingSafeEqual` preventing `RangeError` crashes on malformed hashes.
7. **Production Auth Safeguard**: Blocked `AUTH_DISABLED=true` in production mode unless explicitly confirmed via `ALLOW_INSECURE_AUTH_BYPASS=true`.
8. **Parameterized Query in `getAlbums()`**: Replaced `${effectiveChecked}` string interpolation with parameterized binding `t2.manually_checked = ?`.
9. **Atomic Fixer Rule Batch Updates**: Enclosed both the album fixer rules update and track updates inside a single SQLite transaction.
10. **Lossless Audio Quality Refinement**: Differentiated Hi-Res lossless (24-bit / >48kHz -> `perfect`) from standard CD quality lossless (16-bit / 44.1kHz -> `good`).
11. **MusicBrainz Picard Integration (Containerized Web GUI)**:
    - Added `picard` service (`jlesage/musicbrainz-picard:latest`) to `docker-compose.yml` exposing browser Web GUI on port `5800`.
    - Configured shared `./music` volume mounted read-write (`:rw`) to Picard for writing tags, while Track Vault maintains `:ro` read-only access.
    - Added configurable `PICARD_URL` environment variable defaulting to `http://localhost:5800`.
    - Added deep UI shortcuts and links to Picard across Track Vault:
      - Desktop Navbar & Mobile Navigation bottom bar.
      - Library Scanner banner for untagged / unknown music files.
      - Album detail action bar ("Tag in Picard" shortcut).
      - Account Settings system information card with direct launch button.
12. **Interactive LRC Maker Studio (`/lrc-maker`)**:
    - Added database columns `file_path` and `lyrics_text` to `tracks` table with idempotent `PRAGMA table_info` migrations.
    - Added audio streaming endpoint `GET /api/tracks/[id]/audio` with HTTP 206 Partial Content (Range byte seeking).
    - Added lyrics endpoint `GET / POST /api/tracks/[id]/lyrics` supporting database persistence and companion `.lrc` file saving.
    - Added LRCLIB proxy endpoint `GET /api/lyrics/search` for 1-click lyric lookups from lrclib.net.
    - Integrated deep shortcuts across Track Vault: Navbar desktop & mobile, `TrackRow` row action button, and The Fixer issues table.
13. **Direct Song Folder Companion Lyrics Read & Write**:
    - Made `/music` volume mount read-write (`:rw`) in `docker-compose.yml`.
    - Added `findCompanionLyricsFile(filePath, title)` to `src/lib/server/scanner.ts` with multi-strategy discovery (exact matches, case insensitivity, zero-padded track numbers `001` vs `01`, and title-based matches).
    - Added startup database migration backfill resolving `file_path` and `lyrics_text` for existing library tracks without data loss.
    - Updated `GET /api/tracks/[id]/lyrics` to read companion `.lrc` and `.txt` files directly from disk as the source of truth, and `POST /api/tracks/[id]/lyrics` to write edits directly back into the song's folder on disk.
    - Added cross-environment `resolveTrackFilePath()` in `scanner.ts` reconciling host and Docker container `/music` path mount differences.
    - Added Quick Lyrics File Editor Modal in `src/routes/album/[id]/+page.svelte` and quick trigger in `TrackRow.svelte`.
14. **Playback Song Time Line Focus & Navbar Declutter**:
    - In `src/routes/lrc-maker/+page.svelte`, added reactive `currentPlaybackLineIndex` derived from audio `currentTime` and an auto-scroll effect smoothly centering the active singing line during playback.
    - Added visual active line highlighting (emerald pulsating badge, glowing ring, text elevation) and an `Auto-Follow: ON/OFF` toggle.
    - Redesigned `src/lib/components/Navbar.svelte`: consolidated secondary studio links into a clean `Tools` dropdown (`LRC Maker Studio` + `Picard Tagger`), removed duplicate settings tab on desktop, and streamlined mobile navigation to 5 clean, evenly-spaced tabs (`Vault`, `Fixer`, `Scan`, `LRC`, `Settings`).
15. **Instrumental Lyrics Option & Multi-Line Batch Time Shifting**:
    - Added `isInstrumentalLyrics(content)` in `src/lib/server/scanner.ts` detecting `[00:00.00]♪`, `[00:00.00][instrumental]`, `[au:Instrumental]`, etc., and updated `findCompanionLyricsFile()` and `detectLyrics()` to classify companion files as `type: 'instrumental'`.
    - Updated `POST /api/tracks/[id]/lyrics` to auto-detect instrumental content and ensure `.lrc` extension is retained when writing companion files to disk.
    - Added instrumental mode toggle & format selector (`♪ Musical Note` vs `Tag`) to LRC Maker header, LRCLIB modal, and Synchronizer mode.
    - Added multi-line selection (individual checkboxes, Shift+Click range select, select all, clear) and batch time shifting toolbar (`±1.0s`, `±0.5s`, `±0.1s`, custom seconds input, and bulk clear timestamps).
    - Added "Mark Instrumental" 1-click shortcut button in Album detail Quick Lyrics File Editor Modal.
16. **Spotify-Inspired Music Player Tab, Split Navbar, & LRC Input Fix**:
    - Split navbar tools into direct top-level links: `Vault`, `Player`, `Fixer`, `LRC Maker`, `Scan`, and `Picard`. Updated mobile bottom navigation to a clean 6-tab layout.
    - Fixed LRC Maker custom time shift input: expanded input width, eliminated native browser arrow spinners blocking the number, and added dedicated increment/decrement steppers with `±sec` formatting.
    - Added full-featured Spotify clone music player at `/player` (`src/routes/player/+page.svelte` & `+page.server.ts`):
      - 3-pane layout with 'Your Library' album search and filter chips (All, Verified, Lossless).
      - Spotify album hero with large artwork, metadata, and big green play button.
      - Full interactive tracklist table with active song equalizer animations and direct audio streaming (`/api/tracks/[id]/audio`).
      - Spotify Synced Lyrics drawer with real-time scrolling karaoke playback, instrumental track indicators, and timestamp click-to-seek.
      - Persistent bottom Spotify player bar with playback controls, shuffle, repeat (all/one), scrubber progress slider, volume controls, keyboard shortcuts, and MediaSession integration.
17. **Track Vault Audiophile Studio Player & Viewport Scroll Fix**:
    - Resolved full-page browser scrolling on `/player` by dynamically conditioning `src/routes/+layout.svelte` to apply `h-[100dvh] overflow-hidden` and omit the global footer when viewing `/player`.
    - Constrained scrolling strictly to inner containers (`overflow-y-auto min-h-0` on tracklist table, library drawer, and lyrics panel) so mouse wheel scrolling smoothly moves songs without shifting the page layout.
    - Redesigned player with a bespoke Track Vault audiophile studio aesthetic: obsidian glassmorphic panels (`bg-neutral-900/60 backdrop-blur-xl`), floating rounded studio bottom dock (`bg-neutral-900/85 backdrop-blur-2xl shadow-2xl`), vibrant gradient play button (`from-emerald-500 to-teal-400`), high-res vinyl album sleeve with ambient emerald glow, and studio teleprompter lyrics.
18. **Persistent Background Audio Across Tabs & Player Lyrics Refinement**:
    - Centralized audio playback into a singleton Svelte 5 store (`src/lib/services/player.svelte.ts`) and mounted a persistent `<audio>` element inside root `+layout.svelte`.
    - Enabled uninterrupted background music playback when navigating between any pages (`/`, `/issues`, `/lrc-maker`, `/scan`, `/settings`) and across browser tabs.
    - Added floating `GlobalMiniPlayer.svelte` dock on non-player pages with album art, track details, play/pause, skip, progress scrubber, volume, open studio player shortcut, and stop/close dismiss button.
    - Refined lyrics typography in `/player`: enlarged default inactive lines to `text-[15px] font-medium leading-relaxed` and active singing line to `text-[17px] font-bold leading-relaxed text-emerald-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.35)] bg-emerald-950/20`, eliminating jarring 2x size jumps and layout shifts.

---

## 4. Workflows & Verification

### Code Quality Check
Before committing changes, always verify:
```bash
npm run check    # svelte-check TypeScript & Svelte validation
npm run build    # Vite production build
```

### Docker Deployments (Mandatory)
Every new version must be rebuilt and run in Docker:
```bash
docker compose up -d --build
```
Verify the container is healthy:
```bash
docker compose ps
docker logs track-vault --tail 20
```

### Git Workflow & Commits
- **Remote:** `origin` (`git@github.com:Kapybara48/track-vault.git`)
- **Default branch:** `main`
- When instructed to commit and push:
  1. Check git status: `git status`
  2. Stage files: `git add <files>`
  3. Commit with a clear, concise message: `git commit -m "..."`
  4. Push to remote: `git push origin main`
