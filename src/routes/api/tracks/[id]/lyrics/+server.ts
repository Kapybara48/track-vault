import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getTrackById, saveTrackLyrics } from '$lib/server/db.js';
import { findCompanionLyricsFile, resolveTrackFilePath } from '$lib/server/scanner.js';
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
	let isWritable = true;
	const audioPath = resolveTrackFilePath(track);

	// 1. Read directly from the song's folder if companion file exists on disk
	if (audioPath) {
		const companion = findCompanionLyricsFile(audioPath, track.title);
		if (companion) {
			companionPath = companion.filePath;
			hasCompanion = true;
			lyricsText = companion.content;
			isWritable = companion.isWritable;

			// Keep DB in sync with disk content
			if (track.lyrics_text !== companion.content) {
				try {
					saveTrackLyrics(trackId, companion.content, companion.type);
				} catch {
					// Ignore
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
		is_writable: isWritable,
		has_audio_file: !!audioPath,
		file_path: audioPath || track.file_path
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
	
	// Auto-detect status if not specified or verify synced vs plain
	let status: LyricsStatus = body.status || 'synced_lrc';
	if (!body.status) {
		const hasTimestamps = /\[\d{1,2}:\d{2}/.test(lyricsText);
		status = hasTimestamps ? 'synced_lrc' : 'plain_txt';
	}

	// 1. Save directly to the song's folder file on disk
	let savedToDisk = false;
	let diskError: string | null = null;
	let diskPath: string | null = null;
	const audioPath = resolveTrackFilePath(track);

	if (audioPath) {
		const dir = path.dirname(audioPath);
		
		// Check if companion file already exists
		const existingCompanion = findCompanionLyricsFile(audioPath, track.title);
		if (existingCompanion) {
			diskPath = existingCompanion.filePath;
		} else {
			const base = path.basename(audioPath, path.extname(audioPath));
			const ext = status === 'synced_lrc' ? '.lrc' : '.txt';
			diskPath = path.join(dir, `${base}${ext}`);
		}

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

	// 2. Save to SQLite database
	let updatedTrack;
	try {
		updatedTrack = saveTrackLyrics(trackId, lyricsText, status);
	} catch (err: any) {
		return json({ error: `Database error: ${err.message}` }, { status: 500 });
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
