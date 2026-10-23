import fs from 'node:fs';
import path from 'node:path';
import type { PageServerLoad } from './$types.js';
import { getTrackById } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ url }) => {
	const trackIdParam = url.searchParams.get('trackId');
	if (!trackIdParam) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: ''
		};
	}

	const trackId = parseInt(trackIdParam, 10);
	if (isNaN(trackId)) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: ''
		};
	}

	const track = getTrackById(trackId);
	if (!track) {
		return {
			track: null,
			hasServerAudio: false,
			existingLyrics: ''
		};
	}

	let existingLyrics = track.lyrics_text || '';
	let hasServerAudio = false;

	if (track.file_path && fs.existsSync(track.file_path)) {
		hasServerAudio = true;
		if (!existingLyrics) {
			const dir = path.dirname(track.file_path);
			const base = path.basename(track.file_path, path.extname(track.file_path));
			const lrcPath = path.join(dir, `${base}.lrc`);
			const txtPath = path.join(dir, `${base}.txt`);

			if (fs.existsSync(lrcPath)) {
				try {
					existingLyrics = fs.readFileSync(lrcPath, 'utf-8');
				} catch {
					// Ignore
				}
			} else if (fs.existsSync(txtPath)) {
				try {
					existingLyrics = fs.readFileSync(txtPath, 'utf-8');
				} catch {
					// Ignore
				}
			}
		}
	}

	return {
		track,
		hasServerAudio,
		existingLyrics
	};
};
