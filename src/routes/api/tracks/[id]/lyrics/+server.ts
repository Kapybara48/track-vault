import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getTrackById, saveTrackLyrics } from '$lib/server/db.js';
import type { LyricsStatus } from '$lib/types/index.js';

export const GET: RequestHandler = async ({ params }) => {
	const trackId = parseInt(params.id, 10);
	if (isNaN(trackId)) {
		return json({ error: 'Invalid track ID' }, { status: 400 });
	}

	const track = getTrackById(trackId);
	if (!track) {
		return json({ error: 'Track not found' }, { status: 404 });
	}

	let lyricsText = track.lyrics_text || '';
	let companionPath: string | null = null;
	let hasCompanion = false;

	// If no lyrics in DB, attempt reading companion .lrc or .txt from disk
	if (track.file_path && fs.existsSync(track.file_path)) {
		const dir = path.dirname(track.file_path);
		const base = path.basename(track.file_path, path.extname(track.file_path));
		const lrcPath = path.join(dir, `${base}.lrc`);
		const txtPath = path.join(dir, `${base}.txt`);

		if (fs.existsSync(lrcPath)) {
			companionPath = lrcPath;
			hasCompanion = true;
			if (!lyricsText) {
				try {
					lyricsText = fs.readFileSync(lrcPath, 'utf-8');
				} catch {
					// Ignore read errors
				}
			}
		} else if (fs.existsSync(txtPath)) {
			companionPath = txtPath;
			hasCompanion = true;
			if (!lyricsText) {
				try {
					lyricsText = fs.readFileSync(txtPath, 'utf-8');
				} catch {
					// Ignore read errors
				}
			}
		}
	}

	return json({
		success: true,
		lyrics_text: lyricsText,
		lyrics_status: track.lyrics,
		companion_path: companionPath,
		has_companion: hasCompanion,
		has_audio_file: !!(track.file_path && fs.existsSync(track.file_path))
	});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const trackId = parseInt(params.id, 10);
	if (isNaN(trackId)) {
		return json({ error: 'Invalid track ID' }, { status: 400 });
	}

	const track = getTrackById(trackId);
	if (!track) {
		return json({ error: 'Track not found' }, { status: 404 });
	}

	let body: {
		lyrics_text: string;
		status?: LyricsStatus;
		save_to_disk?: boolean;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const lyricsText = typeof body.lyrics_text === 'string' ? body.lyrics_text : '';
	const status: LyricsStatus = body.status || 'synced_lrc';

	// 1. Save to SQLite database
	let updatedTrack;
	try {
		updatedTrack = saveTrackLyrics(trackId, lyricsText, status);
	} catch (err: any) {
		return json({ error: `Database error: ${err.message}` }, { status: 500 });
	}

	// 2. Attempt saving companion .lrc to disk if requested and file_path exists
	let savedToDisk = false;
	let diskError: string | null = null;
	let diskPath: string | null = null;

	if (body.save_to_disk && track.file_path && fs.existsSync(track.file_path)) {
		const dir = path.dirname(track.file_path);
		const base = path.basename(track.file_path, path.extname(track.file_path));
		diskPath = path.join(dir, `${base}.lrc`);

		try {
			fs.writeFileSync(diskPath, lyricsText, 'utf-8');
			savedToDisk = true;
		} catch (err: any) {
			diskError =
				err.code === 'EROFS'
					? 'Music directory is mounted read-only (:ro). Synced lyrics saved to Track Vault database only.'
					: `Could not write to disk: ${err.message}`;
		}
	}

	return json({
		success: true,
		track: updatedTrack,
		saved_to_db: true,
		saved_to_disk: savedToDisk,
		disk_path: diskPath,
		disk_error: diskError
	});
};
