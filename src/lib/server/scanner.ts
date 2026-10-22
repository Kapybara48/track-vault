import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { db } from '$lib/server/db.js';
import { createAlbum } from '$lib/server/db.js';
import type {
	ScannedAlbum,
	ScannedTrack,
	AudioFormat,
	QualityRating,
	CensorshipStatus,
	LyricsStatus
} from '$lib/types/index.js';

const AUDIO_EXTENSIONS = new Set([
	'.flac',
	'.mp3',
	'.m4a',
	'.aac',
	'.ogg',
	'.opus',
	'.wav',
	'.aiff',
	'.wma',
	'.alac'
]);

export function getMusicDirectory(): string {
	if (process.env.MUSIC_DIR) {
		return path.resolve(process.env.MUSIC_DIR);
	}
	return path.resolve('./music');
}

/**
 * Determine audio format and quality rating based on metadata
 */
function detectFormatAndQuality(
	container?: string,
	codec?: string,
	bitrate?: number,
	bitsPerSample?: number
): { format: AudioFormat; quality: QualityRating } {
	const c = (codec || container || '').toLowerCase();

	if (c.includes('flac')) {
		const quality: QualityRating = (bitsPerSample && bitsPerSample > 16) ? 'perfect' : 'good';
		return { format: 'FLAC', quality };
	}

	if (c.includes('alac') || c.includes('apple lossless')) {
		return { format: 'ALAC', quality: 'perfect' };
	}

	if (c.includes('wav') || c.includes('pcm') || c.includes('aiff')) {
		return { format: 'WAV', quality: 'perfect' };
	}

	if (c.includes('aac') || c.includes('mp4a') || c.includes('m4a')) {
		return { format: 'AAC_256', quality: 'good' };
	}

	if (c.includes('ogg') || c.includes('vorbis') || c.includes('opus')) {
		return { format: 'OGG', quality: 'good' };
	}

	// MP3 or other lossy
	if (c.includes('mpeg') || c.includes('mp3') || c.includes('layer 3')) {
		const brKbps = bitrate ? Math.round(bitrate / 1000) : 0;
		if (brKbps >= 310) {
			return { format: 'MP3_320', quality: 'good' };
		}
		if (brKbps >= 220) {
			return { format: 'MP3_V0', quality: 'good' };
		}
		if (brKbps >= 180) {
			return { format: 'MP3_192', quality: 'acceptable' };
		}
		if (brKbps > 0) {
			return { format: 'MP3_128', quality: 'bad' }; // Low bitrate, needs upgrade!
		}
		return { format: 'MP3_320', quality: 'good' };
	}

	return { format: 'OTHER', quality: 'acceptable' };
}

/**
 * Detect lyrics: checks companion .lrc / .txt files in same directory, or embedded lyrics tags
 */
function detectLyrics(filePath: string, embeddedLyrics?: any): { status: LyricsStatus; hasLrc: boolean; hasTxt: boolean } {
	const dir = path.dirname(filePath);
	const baseNameWithoutExt = path.basename(filePath, path.extname(filePath));

	const lrcPath = path.join(dir, `${baseNameWithoutExt}.lrc`);
	const txtPath = path.join(dir, `${baseNameWithoutExt}.txt`);

	const hasLrc = fs.existsSync(lrcPath);
	if (hasLrc) {
		return { status: 'synced_lrc', hasLrc: true, hasTxt: false };
	}

	const hasTxt = fs.existsSync(txtPath);
	if (hasTxt) {
		return { status: 'plain_txt', hasLrc: false, hasTxt: true };
	}

	// Check embedded lyrics
	if (embeddedLyrics) {
		const text = Array.isArray(embeddedLyrics)
			? embeddedLyrics.map((l) => (typeof l === 'string' ? l : l.text || '')).join('\n')
			: typeof embeddedLyrics === 'string'
			? embeddedLyrics
			: embeddedLyrics.text || '';

		if (text.trim().length > 0) {
			// Check if timestamped like [01:23.45]
			const hasTimestamps = /\[\d{2}:\d{2}/.test(text);
			return {
				status: hasTimestamps ? 'synced_lrc' : 'plain_txt',
				hasLrc: false,
				hasTxt: false
			};
		}
	}

	return { status: 'missing', hasLrc: false, hasTxt: false };
}

/**
 * Detect censorship status from title, tags, or file name
 */
function detectCensorship(title: string, rawTags?: any): CensorshipStatus {
	const lowerTitle = title.toLowerCase();

	if (
		lowerTitle.includes('(radio edit)') ||
		lowerTitle.includes('(clean)') ||
		lowerTitle.includes('[clean]') ||
		lowerTitle.includes('(clean version)') ||
		lowerTitle.includes('(censored)')
	) {
		return 'censored'; // Radio edit / censored -> Flagged to replace with explicit!
	}

	if (
		lowerTitle.includes('(explicit)') ||
		lowerTitle.includes('[explicit]') ||
		lowerTitle.includes('explicit version')
	) {
		return 'explicit';
	}

	// Check iTunes advisory tag: 1 = explicit, 2 = clean
	if (rawTags?.itunesAdvisory === 1 || rawTags?.['ITUNESADVISORY'] === '1') {
		return 'explicit';
	}
	if (rawTags?.itunesAdvisory === 2 || rawTags?.['ITUNESADVISORY'] === '2') {
		return 'censored';
	}

	return 'clean_original';
}

/**
 * Find local folder cover art image if available
 */
function findLocalCoverArt(dir: string): string | null {
	const candidates = [
		'cover.jpg',
		'cover.jpeg',
		'cover.png',
		'folder.jpg',
		'folder.png',
		'front.jpg',
		'front.jpeg',
		'front.png',
		'albumart.jpg',
		'album.jpg'
	];

	for (const candidate of candidates) {
		const full = path.join(dir, candidate);
		if (fs.existsSync(full)) {
			// Return relative path or file URL
			return `/api/library/cover?path=${encodeURIComponent(full)}`;
		}
	}

	return null;
}

/**
 * Extract MusicBrainz ID string safely (handles arrays or strings)
 */
function cleanMbId(val: any): string | null {
	if (!val) return null;
	if (Array.isArray(val)) {
		val = val[0];
	}
	if (typeof val === 'string' && val.trim().length >= 32) {
		return val.trim();
	}
	return null;
}

/**
 * Scan a single audio file and extract all tags + MusicBrainz data
 */
export async function scanAudioFile(filePath: string): Promise<ScannedTrack | null> {
	try {
		const metadata = await parseFile(filePath, { duration: true, skipCovers: true });
		const common = metadata.common;
		const format = metadata.format;

		const fileName = path.basename(filePath);
		const title = common.title || path.basename(filePath, path.extname(filePath));
		const artist = common.artist || common.albumartist || 'Unknown Artist';
		const album = common.album || path.basename(path.dirname(filePath));
		const year = common.year || null;
		const trackNumber = common.track.no || 1;
		const discNumber = common.disk.no || 1;
		const durationMs = format.duration ? Math.round(format.duration * 1000) : null;

		const { format: audioFmt, quality: audioQuality } = detectFormatAndQuality(
			format.container,
			format.codec,
			format.bitrate,
			format.bitsPerSample
		);

		const { status: lyricsStatus, hasLrc, hasTxt } = detectLyrics(filePath, common.lyrics);
		const censorshipStatus = detectCensorship(title, common);

		// MusicBrainz tags!
		const mbAlbumId = cleanMbId(common.musicbrainz_albumid);
		const mbTrackId = cleanMbId(common.musicbrainz_trackid);
		const mbArtistId = cleanMbId(common.musicbrainz_artistid);
		const mbReleaseGroupId = cleanMbId(common.musicbrainz_releasegroupid);

		const bitrateKbps = format.bitrate ? Math.round(format.bitrate / 1000) : null;

		return {
			file_path: filePath,
			file_name: fileName,
			title,
			artist,
			album,
			year,
			track_number: trackNumber,
			disc_number: discNumber,
			duration_ms: durationMs,
			format: audioFmt,
			bitrate_kbps: bitrateKbps,
			sample_rate: format.sampleRate || null,
			bits_per_sample: format.bitsPerSample || null,
			quality_rating: audioQuality,
			censorship: censorshipStatus,
			lyrics: lyricsStatus,
			has_lrc_file: hasLrc,
			has_txt_file: hasTxt,
			musicbrainz_album_id: mbAlbumId,
			musicbrainz_track_id: mbTrackId,
			musicbrainz_artist_id: mbArtistId,
			musicbrainz_releasegroup_id: mbReleaseGroupId,
			selected: true
		};
	} catch (err) {
		console.warn(`Failed to parse metadata for file ${filePath}:`, err);
		return null;
	}
}

/**
 * Scan a music folder recursively and group audio files by album
 */
export async function scanLibraryDirectory(targetDir?: string): Promise<{
	albums: ScannedAlbum[];
	totalFiles: number;
	libraryPath: string;
	exists: boolean;
}> {
	const dir = targetDir ? path.resolve(targetDir) : getMusicDirectory();

	if (!fs.existsSync(dir)) {
		return { albums: [], totalFiles: 0, libraryPath: dir, exists: false };
	}

	const audioFiles: string[] = [];

	function walk(currentDir: string) {
		try {
			const entries = fs.readdirSync(currentDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name.startsWith('.')) continue; // skip hidden files/.git

				const fullPath = path.join(currentDir, entry.name);
				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.isFile()) {
					const ext = path.extname(entry.name).toLowerCase();
					if (AUDIO_EXTENSIONS.has(ext)) {
						audioFiles.push(fullPath);
					}
				}
			}
		} catch (err) {
			console.error(`Cannot read directory ${currentDir}:`, err);
		}
	}

	walk(dir);

	// Parse audio metadata for each file
	const scannedTracks: ScannedTrack[] = [];
	for (const file of audioFiles) {
		const track = await scanAudioFile(file);
		if (track) {
			scannedTracks.push(track);
		}
	}

	// Group tracks by album:
	// Prioritize folder + album/artist so all tracks in an album folder are grouped together
	const albumGroups: { [key: string]: { tracks: ScannedTrack[]; folder: string } } = {};

	for (const tr of scannedTracks) {
		const folder = path.dirname(tr.file_path);
		let key: string;

		if (tr.album && tr.artist && tr.album !== 'Unknown Album') {
			key = `${folder}::${tr.artist.toLowerCase()} - ${tr.album.toLowerCase()}`;
		} else if (tr.musicbrainz_album_id) {
			key = `mb:${tr.musicbrainz_album_id}`;
		} else {
			key = `dir:${folder}`;
		}

		if (!albumGroups[key]) {
			albumGroups[key] = { tracks: [], folder };
		}
		albumGroups[key].tracks.push(tr);
	}

	const scannedAlbums: ScannedAlbum[] = [];

	for (const [key, group] of Object.entries(albumGroups)) {
		// MusicBrainz ID if present on ANY track in this album
		const mbId = group.tracks.find((t) => t.musicbrainz_album_id)?.musicbrainz_album_id || null;

		// Propagate album MBID to all tracks in this album if missing
		if (mbId) {
			for (const t of group.tracks) {
				if (!t.musicbrainz_album_id) {
					t.musicbrainz_album_id = mbId;
				}
			}
		}

		// Sort tracks by disc and track number
		group.tracks.sort((a, b) => {
			if (a.disc_number !== b.disc_number) return a.disc_number - b.disc_number;
			return a.track_number - b.track_number;
		});

		const first = group.tracks[0];
		const albumTitle = first.album || path.basename(group.folder);
		const albumArtist = first.artist || 'Unknown Artist';
		const albumYear = group.tracks.find((t) => t.year)?.year || null;

		// Cover Art: Local cover file or Cover Art Archive via MBID
		let coverUrl = findLocalCoverArt(group.folder);
		if (!coverUrl && mbId) {
			coverUrl = `https://coverartarchive.org/release/${mbId}/front-500`;
		}

		// Check if already in vault SQLite DB
		let alreadyInVault = false;
		if (mbId) {
			const row = db.prepare('SELECT id FROM albums WHERE musicbrainz_id = ?').get(mbId);
			if (row) alreadyInVault = true;
		}
		if (!alreadyInVault) {
			const row = db.prepare(
				'SELECT id FROM albums WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)'
			).get(albumTitle, albumArtist);
			if (row) alreadyInVault = true;
		}

		const hasFlac = group.tracks.some((t) => t.format === 'FLAC' || t.format === 'ALAC');
		const hasLrc = group.tracks.some((t) => t.lyrics === 'synced_lrc');

		scannedAlbums.push({
			album_key: key,
			title: albumTitle,
			artist: albumArtist,
			year: albumYear,
			folder_path: group.folder,
			musicbrainz_id: mbId,
			cover_url: coverUrl,
			track_count: group.tracks.length,
			has_flac: hasFlac,
			has_lrc: hasLrc,
			already_in_vault: alreadyInVault,
			tracks: group.tracks,
			selected: !alreadyInVault
		});
	}

	// Sort albums: albums not in vault first, then alphabetically
	scannedAlbums.sort((a, b) => {
		if (a.already_in_vault !== b.already_in_vault) {
			return a.already_in_vault ? 1 : -1;
		}
		return a.title.localeCompare(b.title);
	});

	return {
		albums: scannedAlbums,
		totalFiles: audioFiles.length,
		libraryPath: dir,
		exists: true
	};
}

/**
 * Import a scanned album and only its chosen/selected tracks into Track Vault
 */
export async function importScannedAlbum(
	album: ScannedAlbum,
	selectedFilePaths?: string[]
): Promise<number> {
	// Filter tracks if selectedFilePaths provided
	let chosenTracks = album.tracks;
	if (selectedFilePaths && selectedFilePaths.length > 0) {
		const selectedSet = new Set(selectedFilePaths);
		chosenTracks = album.tracks.filter((t) => selectedSet.has(t.file_path));
	}

	if (chosenTracks.length === 0) {
		throw new Error('No tracks selected for import');
	}

	const tracksData = chosenTracks.map((t) => ({
		disc_number: t.disc_number,
		track_number: t.track_number,
		title: t.title,
		artist: t.artist !== album.artist ? t.artist : null,
		duration_ms: t.duration_ms,
		format: t.format,
		quality_rating: t.quality_rating,
		censorship: t.censorship,
		lyrics: t.lyrics,
		notes: `Imported from: ${path.basename(t.file_path)}`
	}));

	const albumId = createAlbum(
		{
			musicbrainz_id: album.musicbrainz_id,
			title: album.title,
			artist: album.artist,
			release_year: album.year,
			cover_url: album.cover_url,
			media_type: album.has_flac ? 'FLAC Digital' : 'Digital',
			notes: `Imported from local library folder: ${album.folder_path}`
		},
		tracksData
	);

	return albumId;
}
