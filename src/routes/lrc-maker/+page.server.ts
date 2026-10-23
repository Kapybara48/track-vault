import fs from 'node:fs';
import path from 'node:path';
import type { PageServerLoad } from './$types.js';
import { getTrackById } from '$lib/server/db.js';
import { findCompanionLyricsFile, resolveTrackFilePath } from '$lib/server/scanner.js';

export const load: PageServerLoad = async ({ url }) => {
	const trackIdParam = url.searchParams.get('trackId');
	if (!trackIdParam) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: '',
			companionPath: null
		};
	}

	const trackId = parseInt(trackIdParam, 10);
	if (isNaN(trackId)) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: '',
			companionPath: null
		};
	}

	const track = getTrackById(trackId);
	if (!track) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: '',
			companionPath: null
		};
	}

	let existingLyrics = track.lyrics_text || '';
	let hasServerAudio = false;
	let companionPath: string | null = null;
	const audioPath = resolveTrackFilePath(track);

	if (audioPath) {
		hasServerAudio = true;
		const companion = findCompanionLyricsFile(audioPath, track.title);
		if (companion) {
			companionPath = companion.filePath;
			existingLyrics = companion.content;
		}
	}

	return {
		track,
		hasServerAudio,
		existingLyrics,
		companionPath
	};
};
