import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type {
	Album,
	Track,
	CollectionStats,
	AudioFormat,
	QualityRating,
	CensorshipStatus,
	LyricsStatus
} from '$lib/types/index.js';

const DB_PATH = process.env.DATA_DIR
	? path.join(process.env.DATA_DIR, 'trackvault.db')
	: path.resolve('./data/trackvault.db');

// Ensure data folder exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Configure SQLite for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Initialize schema
db.exec(`
	CREATE TABLE IF NOT EXISTS albums (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		musicbrainz_id TEXT,
		title TEXT NOT NULL,
		artist TEXT NOT NULL,
		release_year INTEGER,
		genre TEXT,
		cover_url TEXT,
		media_type TEXT,
		notes TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS tracks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		disc_number INTEGER NOT NULL DEFAULT 1,
		track_number INTEGER NOT NULL,
		title TEXT NOT NULL,
		artist TEXT,
		duration_ms INTEGER,
		format TEXT NOT NULL DEFAULT 'FLAC',
		quality_rating TEXT NOT NULL DEFAULT 'good',
		censorship TEXT NOT NULL DEFAULT 'explicit',
		lyrics TEXT NOT NULL DEFAULT 'none',
		needs_attention INTEGER NOT NULL DEFAULT 0,
		notes TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
	CREATE INDEX IF NOT EXISTS idx_tracks_format ON tracks(format);
	CREATE INDEX IF NOT EXISTS idx_tracks_censorship ON tracks(censorship);
	CREATE INDEX IF NOT EXISTS idx_tracks_lyrics ON tracks(lyrics);
	CREATE INDEX IF NOT EXISTS idx_tracks_needs_attention ON tracks(needs_attention);
	CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
`);

/**
 * Helper to determine if a track needs attention
 */
export function computeNeedsAttention(
	quality: QualityRating,
	censorship: CensorshipStatus,
	lyrics: LyricsStatus
): number {
	const badQuality = quality === 'bad' || quality === 'needs_upgrade';
	const isCensored = censorship === 'censored';
	const missingLyrics = lyrics === 'missing';
	return badQuality || isCensored || missingLyrics ? 1 : 0;
}

export function getStats(): CollectionStats {
	const albumCount = (db.prepare('SELECT COUNT(*) as count FROM albums').get() as { count: number }).count;
	const trackCount = (db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number }).count;

	if (trackCount === 0) {
		return {
			total_albums: albumCount,
			total_tracks: 0,
			flac_count: 0,
			mp3_count: 0,
			other_format_count: 0,
			bad_quality_count: 0,
			censored_count: 0,
			missing_lyrics_count: 0,
			synced_lyrics_count: 0,
			plain_lyrics_count: 0,
			total_needs_attention: 0,
			health_score: 100
		};
	}

	const formatCounts = db.prepare(`
		SELECT 
			SUM(CASE WHEN format IN ('FLAC', 'ALAC', 'WAV', 'AIFF') THEN 1 ELSE 0 END) as flac_count,
			SUM(CASE WHEN format LIKE 'MP3%' THEN 1 ELSE 0 END) as mp3_count,
			SUM(CASE WHEN format NOT IN ('FLAC', 'ALAC', 'WAV', 'AIFF') AND format NOT LIKE 'MP3%' THEN 1 ELSE 0 END) as other_count
		FROM tracks
	`).get() as { flac_count: number; mp3_count: number; other_count: number };

	const issueCounts = db.prepare(`
		SELECT
			SUM(CASE WHEN quality_rating IN ('bad', 'needs_upgrade') THEN 1 ELSE 0 END) as bad_quality,
			SUM(CASE WHEN censorship = 'censored' THEN 1 ELSE 0 END) as censored,
			SUM(CASE WHEN lyrics = 'missing' THEN 1 ELSE 0 END) as missing_lyrics,
			SUM(CASE WHEN lyrics = 'synced_lrc' THEN 1 ELSE 0 END) as synced_lyrics,
			SUM(CASE WHEN lyrics = 'plain_txt' THEN 1 ELSE 0 END) as plain_lyrics,
			SUM(CASE WHEN needs_attention = 1 THEN 1 ELSE 0 END) as needs_attention
		FROM tracks
	`).get() as {
		bad_quality: number;
		censored: number;
		missing_lyrics: number;
		synced_lyrics: number;
		plain_lyrics: number;
		needs_attention: number;
	};

	// Health score is percentage of tracks with NO issues
	const goodTracks = Math.max(0, trackCount - (issueCounts.needs_attention || 0));
	const healthScore = Math.round((goodTracks / trackCount) * 100);

	return {
		total_albums: albumCount,
		total_tracks: trackCount,
		flac_count: formatCounts.flac_count || 0,
		mp3_count: formatCounts.mp3_count || 0,
		other_format_count: formatCounts.other_count || 0,
		bad_quality_count: issueCounts.bad_quality || 0,
		censored_count: issueCounts.censored || 0,
		missing_lyrics_count: issueCounts.missing_lyrics || 0,
		synced_lyrics_count: issueCounts.synced_lyrics || 0,
		plain_lyrics_count: issueCounts.plain_lyrics || 0,
		total_needs_attention: issueCounts.needs_attention || 0,
		health_score: healthScore
	};
}

export function getAlbums(searchQuery?: string, filter?: string): Album[] {
	let sql = `
		SELECT 
			a.*,
			COUNT(t.id) as track_count,
			SUM(CASE WHEN t.quality_rating IN ('bad', 'needs_upgrade') THEN 1 ELSE 0 END) as bad_quality_count,
			SUM(CASE WHEN t.censorship = 'censored' THEN 1 ELSE 0 END) as censored_count,
			SUM(CASE WHEN t.lyrics = 'missing' THEN 1 ELSE 0 END) as missing_lyrics_count
		FROM albums a
		LEFT JOIN tracks t ON t.album_id = a.id
	`;

	const conditions: string[] = [];
	const params: (string | number)[] = [];

	if (searchQuery && searchQuery.trim()) {
		conditions.push('(a.title LIKE ? OR a.artist LIKE ? OR a.genre LIKE ?)');
		const q = `%${searchQuery.trim()}%`;
		params.push(q, q, q);
	}

	if (filter === 'needs_attention') {
		conditions.push(`a.id IN (SELECT album_id FROM tracks WHERE needs_attention = 1)`);
	} else if (filter === 'bad_quality') {
		conditions.push(`a.id IN (SELECT album_id FROM tracks WHERE quality_rating IN ('bad', 'needs_upgrade'))`);
	} else if (filter === 'censored') {
		conditions.push(`a.id IN (SELECT album_id FROM tracks WHERE censorship = 'censored')`);
	} else if (filter === 'missing_lyrics') {
		conditions.push(`a.id IN (SELECT album_id FROM tracks WHERE lyrics = 'missing')`);
	} else if (filter === 'all_good') {
		conditions.push(`a.id NOT IN (SELECT album_id FROM tracks WHERE needs_attention = 1) AND a.id IN (SELECT album_id FROM tracks)`);
	}

	if (conditions.length > 0) {
		sql += ` WHERE ` + conditions.join(' AND ');
	}

	sql += ` GROUP BY a.id ORDER BY a.artist COLLATE NOCASE ASC, a.release_year ASC, a.title COLLATE NOCASE ASC`;

	return db.prepare(sql).all(...params) as Album[];
}

export function getAlbumById(id: number): { album: Album; tracks: Track[] } | null {
	const album = db.prepare(`
		SELECT 
			a.*,
			COUNT(t.id) as track_count,
			SUM(CASE WHEN t.quality_rating IN ('bad', 'needs_upgrade') THEN 1 ELSE 0 END) as bad_quality_count,
			SUM(CASE WHEN t.censorship = 'censored' THEN 1 ELSE 0 END) as censored_count,
			SUM(CASE WHEN t.lyrics = 'missing' THEN 1 ELSE 0 END) as missing_lyrics_count
		FROM albums a
		LEFT JOIN tracks t ON t.album_id = a.id
		WHERE a.id = ?
		GROUP BY a.id
	`).get(id) as Album | undefined;

	if (!album) return null;

	const tracks = db.prepare(`
		SELECT * FROM tracks
		WHERE album_id = ?
		ORDER BY disc_number ASC, track_number ASC
	`).all(id) as Track[];

	return { album, tracks };
}

export function createAlbum(
	albumData: {
		title: string;
		artist: string;
		release_year?: number | null;
		genre?: string | null;
		cover_url?: string | null;
		media_type?: string | null;
		musicbrainz_id?: string | null;
		notes?: string | null;
	},
	tracksData: Array<{
		disc_number?: number;
		track_number: number;
		title: string;
		artist?: string | null;
		duration_ms?: number | null;
		format?: AudioFormat;
		quality_rating?: QualityRating;
		censorship?: CensorshipStatus;
		lyrics?: LyricsStatus;
		notes?: string | null;
	}> = []
): number {
	const insertAlbum = db.prepare(`
		INSERT INTO albums (musicbrainz_id, title, artist, release_year, genre, cover_url, media_type, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);

	const insertTrack = db.prepare(`
		INSERT INTO tracks (album_id, disc_number, track_number, title, artist, duration_ms, format, quality_rating, censorship, lyrics, needs_attention, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	const transaction = db.transaction(() => {
		const result = insertAlbum.run(
			albumData.musicbrainz_id ?? null,
			albumData.title.trim(),
			albumData.artist.trim(),
			albumData.release_year ?? null,
			albumData.genre?.trim() ?? null,
			albumData.cover_url?.trim() ?? null,
			albumData.media_type?.trim() ?? 'Digital',
			albumData.notes?.trim() ?? null
		);

		const albumId = Number(result.lastInsertRowid);

		for (const t of tracksData) {
			const format = t.format || 'FLAC';
			const quality = t.quality_rating || 'good';
			const censorship = t.censorship || 'clean_original';
			const lyrics = t.lyrics || 'missing';
			const needsAtt = computeNeedsAttention(quality, censorship, lyrics);

			insertTrack.run(
				albumId,
				t.disc_number || 1,
				t.track_number,
				t.title.trim(),
				t.artist?.trim() ?? null,
				t.duration_ms ?? null,
				format,
				quality,
				censorship,
				lyrics,
				needsAtt,
				t.notes?.trim() ?? null
			);
		}

		return albumId;
	});

	return transaction();
}

export function updateAlbum(
	id: number,
	data: Partial<{
		title: string;
		artist: string;
		release_year: number | null;
		genre: string | null;
		cover_url: string | null;
		media_type: string | null;
		notes: string | null;
	}>
): void {
	const updates: string[] = ['updated_at = datetime(\'now\')'];
	const params: (string | number | null)[] = [];

	if (data.title !== undefined) {
		updates.push('title = ?');
		params.push(data.title.trim());
	}
	if (data.artist !== undefined) {
		updates.push('artist = ?');
		params.push(data.artist.trim());
	}
	if (data.release_year !== undefined) {
		updates.push('release_year = ?');
		params.push(data.release_year);
	}
	if (data.genre !== undefined) {
		updates.push('genre = ?');
		params.push(data.genre?.trim() ?? null);
	}
	if (data.cover_url !== undefined) {
		updates.push('cover_url = ?');
		params.push(data.cover_url?.trim() ?? null);
	}
	if (data.media_type !== undefined) {
		updates.push('media_type = ?');
		params.push(data.media_type?.trim() ?? null);
	}
	if (data.notes !== undefined) {
		updates.push('notes = ?');
		params.push(data.notes?.trim() ?? null);
	}

	params.push(id);
	db.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function deleteAlbum(id: number): void {
	db.prepare('DELETE FROM albums WHERE id = ?').run(id);
}

export function updateTrack(
	id: number,
	data: Partial<{
		disc_number: number;
		track_number: number;
		title: string;
		artist: string | null;
		duration_ms: number | null;
		format: AudioFormat;
		quality_rating: QualityRating;
		censorship: CensorshipStatus;
		lyrics: LyricsStatus;
		notes: string | null;
		needs_attention: number;
	}>
): Track {
	const current = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track | undefined;
	if (!current) throw new Error(`Track with id ${id} not found`);

	const newFormat = data.format ?? current.format;
	const newQuality = data.quality_rating ?? current.quality_rating;
	const newCensorship = data.censorship ?? current.censorship;
	const newLyrics = data.lyrics ?? current.lyrics;
	const autoNeedsAtt = computeNeedsAttention(newQuality, newCensorship, newLyrics);
	const needsAttention = data.needs_attention !== undefined ? data.needs_attention : autoNeedsAtt;

	db.prepare(`
		UPDATE tracks SET
			disc_number = COALESCE(?, disc_number),
			track_number = COALESCE(?, track_number),
			title = COALESCE(?, title),
			artist = CASE WHEN ? = 1 THEN ? ELSE artist END,
			duration_ms = CASE WHEN ? = 1 THEN ? ELSE duration_ms END,
			format = ?,
			quality_rating = ?,
			censorship = ?,
			lyrics = ?,
			needs_attention = ?,
			notes = CASE WHEN ? = 1 THEN ? ELSE notes END,
			updated_at = datetime('now')
		WHERE id = ?
	`).run(
		data.disc_number,
		data.track_number,
		data.title?.trim(),
		data.artist !== undefined ? 1 : 0,
		data.artist?.trim() ?? null,
		data.duration_ms !== undefined ? 1 : 0,
		data.duration_ms ?? null,
		newFormat,
		newQuality,
		newCensorship,
		newLyrics,
		needsAttention,
		data.notes !== undefined ? 1 : 0,
		data.notes?.trim() ?? null,
		id
	);

	return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track;
}

export function batchUpdateAlbumTracks(
	albumId: number,
	updates: Partial<{
		format: AudioFormat;
		quality_rating: QualityRating;
		censorship: CensorshipStatus;
		lyrics: LyricsStatus;
	}>
): void {
	const tracks = db.prepare('SELECT * FROM tracks WHERE album_id = ?').all(albumId) as Track[];
	const updateStmt = db.prepare(`
		UPDATE tracks SET
			format = ?,
			quality_rating = ?,
			censorship = ?,
			lyrics = ?,
			needs_attention = ?,
			updated_at = datetime('now')
		WHERE id = ?
	`);

	const transaction = db.transaction(() => {
		for (const track of tracks) {
			const format = updates.format ?? track.format;
			const quality = updates.quality_rating ?? track.quality_rating;
			const censorship = updates.censorship ?? track.censorship;
			const lyrics = updates.lyrics ?? track.lyrics;
			const needsAtt = computeNeedsAttention(quality, censorship, lyrics);

			updateStmt.run(format, quality, censorship, lyrics, needsAtt, track.id);
		}
	});

	transaction();
}

export function addTrackToAlbum(
	albumId: number,
	trackData: {
		disc_number?: number;
		track_number?: number;
		title: string;
		artist?: string | null;
		duration_ms?: number | null;
		format?: AudioFormat;
		quality_rating?: QualityRating;
		censorship?: CensorshipStatus;
		lyrics?: LyricsStatus;
		notes?: string | null;
	}
): number {
	let trackNumber = trackData.track_number;
	if (!trackNumber) {
		const maxRow = db.prepare(`
			SELECT MAX(track_number) as max_num FROM tracks WHERE album_id = ? AND disc_number = ?
		`).get(albumId, trackData.disc_number || 1) as { max_num: number | null };
		trackNumber = (maxRow?.max_num || 0) + 1;
	}

	const format = trackData.format || 'FLAC';
	const quality = trackData.quality_rating || 'good';
	const censorship = trackData.censorship || 'clean_original';
	const lyrics = trackData.lyrics || 'missing';
	const needsAtt = computeNeedsAttention(quality, censorship, lyrics);

	const result = db.prepare(`
		INSERT INTO tracks (album_id, disc_number, track_number, title, artist, duration_ms, format, quality_rating, censorship, lyrics, needs_attention, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		albumId,
		trackData.disc_number || 1,
		trackNumber,
		trackData.title.trim(),
		trackData.artist?.trim() ?? null,
		trackData.duration_ms ?? null,
		format,
		quality,
		censorship,
		lyrics,
		needsAtt,
		trackData.notes?.trim() ?? null
	);

	return Number(result.lastInsertRowid);
}

export function deleteTrack(trackId: number): void {
	db.prepare('DELETE FROM tracks WHERE id = ?').run(trackId);
}

export function getIssuesTracks(params?: {
	issueType?: string;
	format?: string;
	censorship?: string;
	lyrics?: string;
	search?: string;
	limit?: number;
	offset?: number;
}): { tracks: Track[]; total: number } {
	let sql = `
		SELECT 
			t.*,
			a.title as album_title,
			a.artist as album_artist,
			a.cover_url as album_cover_url,
			a.release_year as album_year
		FROM tracks t
		JOIN albums a ON a.id = t.album_id
	`;

	let countSql = `
		SELECT COUNT(*) as count
		FROM tracks t
		JOIN albums a ON a.id = t.album_id
	`;

	const conditions: string[] = [];
	const queryParams: (string | number)[] = [];

	if (params?.issueType === 'bad_quality') {
		conditions.push("t.quality_rating IN ('bad', 'needs_upgrade')");
	} else if (params?.issueType === 'censored') {
		conditions.push("t.censorship = 'censored'");
	} else if (params?.issueType === 'missing_lyrics') {
		conditions.push("t.lyrics = 'missing'");
	} else if (params?.issueType === 'all_issues') {
		conditions.push('t.needs_attention = 1');
	} else if (params?.issueType === 'good') {
		conditions.push('t.needs_attention = 0');
	}

	if (params?.format) {
		conditions.push('t.format = ?');
		queryParams.push(params.format);
	}

	if (params?.censorship) {
		conditions.push('t.censorship = ?');
		queryParams.push(params.censorship);
	}

	if (params?.lyrics) {
		conditions.push('t.lyrics = ?');
		queryParams.push(params.lyrics);
	}

	if (params?.search && params.search.trim()) {
		conditions.push('(t.title LIKE ? OR t.artist LIKE ? OR a.title LIKE ? OR a.artist LIKE ?)');
		const q = `%${params.search.trim()}%`;
		queryParams.push(q, q, q, q);
	}

	if (conditions.length > 0) {
		const whereClause = ' WHERE ' + conditions.join(' AND ');
		sql += whereClause;
		countSql += whereClause;
	}

	sql += ` ORDER BY t.needs_attention DESC, a.artist COLLATE NOCASE ASC, a.title COLLATE NOCASE ASC, t.disc_number ASC, t.track_number ASC`;

	const total = (db.prepare(countSql).get(...queryParams) as { count: number }).count;

	if (params?.limit) {
		sql += ` LIMIT ? OFFSET ?`;
		const offset = params.offset || 0;
		const tracks = db.prepare(sql).all(...queryParams, params.limit, offset) as Track[];
		return { tracks, total };
	}

	const tracks = db.prepare(sql).all(...queryParams) as Track[];
	return { tracks, total };
}
