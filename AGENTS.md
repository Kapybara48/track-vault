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
