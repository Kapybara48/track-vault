# 💽 Track Vault

**Track Vault** is a modern, self-hosted web application for music collectors and audiophiles to track and audit their music library's audio quality, format status, lyrics coverage, and censorship state.

![Track Vault](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/disc-3.svg)

---

## 🚀 Key Features

- **Audio Quality & Format Auditing**:
  - Track whether you have lossless **FLAC / ALAC / WAV** or lossy encodes (**MP3 320**, **MP3 V0**, **MP3 128**, **AAC**, **OGG**).
  - Rate audio encode quality (*Perfect*, *Good*, *Acceptable*, *Bad / Distorted*, *Needs Upgrade*).
- **Censorship & Clean Edits Tracking**:
  - Mark tracks as **Explicit / Uncensored Original**, **Clean Original**, or **Censored / Radio Edit**.
  - Highlights censored tracks so you know which ones need replacing with their original uncensored releases.
- **Lyrics Coverage Tracking & Studio**:
  - Track whether songs have synchronized time-coded **Synced (.lrc)** lyrics, **Plain text (.txt)**, or are **Missing lyrics**.
  - Flag instrumental tracks where vocals aren't needed.
  - **Interactive LRC Maker Studio (`/lrc-maker`)**:
    - Built-in audio player with Range-seeking server streaming or local drag-and-drop audio file loading.
    - 1-click **LRCLIB.net** integration to fetch plain lyrics or ready-to-use synced lyrics.
    - Synchronize lyrics line-by-line using keyboard hotkeys (`Space` / `Enter`).
    - Millisecond fine-tuning (`+/- 0.1s`), step-back navigation, and real-time live karaoke preview.
    - Save `.lrc` companion files directly to server disk, persist in SQLite database, download `.lrc`, or copy to clipboard.
- **Local Music Library Scanner**:
  - Point Track Vault to your server's music library directory.
  - Automatically reads audio metadata (**FLAC, MP3, M4A, OGG, WAV, etc.**).
  - **Reads embedded MusicBrainz tags** (`musicbrainz_albumid`, `musicbrainz_trackid`, etc.) already present in your files!
  - Automatically detects companion **`.lrc`** or **`.txt`** lyrics files right next to your audio files.
  - **Choose what songs to add and what not**: Select/unselect individual tracks or whole albums before adding to your vault.
- **Online MusicBrainz Search & Import**:
  - Search releases worldwide by artist or album.
  - Pulls complete tracklists, track durations, discs, release year, media format, and official album covers from the Cover Art Archive.
- **Fast Batch Operations**:
  - Bulk update all tracks on an album with 1 click (e.g. set all to FLAC or all to Synced LRC).
- **The Fixer / Issues Dashboard**:
  - High-level **Vault Health Score** (% of pristine tracks).
  - Filter and tackle low-bitrate rips, censored radio edits, and missing lyrics with instant 1-click upgrades.

---

## 🐳 Self-Hosting with Docker

The easiest way to run Track Vault on your server is with Docker Compose.

### 1. Clone repository
```bash
git clone https://github.com/Kapybara48/track-vault.git
cd track-vault
```

### 2. Configure Your Music Directory
Edit `docker-compose.yml` (or create a `.env` file from `.env.example`):

```yaml
services:
  track-vault:
    build: .
    container_name: track-vault
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
      - MUSIC_DIR=/music
      - ORIGIN=http://localhost:3000
      - PICARD_URL=http://localhost:5800
      # Optional: set to true if you want to bypass login on a local network
      # - AUTH_DISABLED=false
    volumes:
      # Persistent SQLite database & album covers
      - ./data:/app/data
      # Mount your existing music collection (read-only for safety)
      - ${MUSIC_PATH:-./music}:/music:ro
    depends_on:
      - picard

  # MusicBrainz Picard Web GUI (tags audio files, AcoustID fingerprints)
  picard:
    image: jlesage/musicbrainz-picard:latest
    container_name: track-vault-picard
    restart: unless-stopped
    ports:
      - "5800:5800"
    environment:
      - USER_ID=1000
      - GROUP_ID=1000
      - TZ=Etc/UTC
    volumes:
      - ./data/picard-config:/config
      # Mount music read-write so Picard can write embedded tags
      - ${MUSIC_PATH:-./music}:/storage
      - ${MUSIC_PATH:-./music}:/music
```

> **Note**: Track Vault mounts your library as `:ro` (read-only) for safety. Picard mounts it read-write so it can write tags and album art directly into your audio files.

### 3. Start Containers
```bash
docker compose up -d --build
```

Access Track Vault and Picard in your browser:
- **Track Vault**: `http://localhost:3000` (auditing, library scanner, issue tracking)
- **MusicBrainz Picard**: `http://localhost:5800` (browser-based GUI to tag files with AcoustID)

On your first visit to Track Vault, you will be greeted with a **First-Run Admin Setup** screen to create your admin credentials. After setup, standard login is enforced unless `AUTH_DISABLED=true` is set in your environment. You can quickly launch Picard at any time from the Navbar, the Library Scanner, album pages, or Settings.

---

## 🛠️ Local Development (Without Docker)

### Prerequisites
- Node.js 20+ or 22+ (v24 supported)
- npm

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Or create production build
npm run build
PORT=3000 MUSIC_DIR=/path/to/music node build
```

---

## 🗄️ Tech Stack

- **Framework**: [SvelteKit 5](https://svelte.dev) + TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Database**: [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with WAL mode enabled
- **Metadata Parsing**: [music-metadata](https://github.com/Borewit/music-metadata) (FLAC, ID3v2, Vorbis, MP4)
- **Metadata Database**: [MusicBrainz API](https://musicbrainz.org) & [Cover Art Archive](https://coverartarchive.org)
- **Icons**: [@lucide/svelte](https://lucide.dev)
