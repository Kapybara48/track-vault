import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getTrackById } from '$lib/server/db.js';
import { getMusicDirectory, isPathWithin } from '$lib/server/scanner.js';

const MIME_MAP: Record<string, string> = {
	'.flac': 'audio/flac',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.aac': 'audio/mp4',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.wav': 'audio/wav',
	'.aif': 'audio/aiff',
	'.aiff': 'audio/aiff',
	'.alac': 'audio/mp4',
	'.wma': 'audio/x-ms-wma'
};

function resolveTrackFilePath(track: any): string | null {
	if (track.file_path && fs.existsSync(track.file_path)) {
		return track.file_path;
	}

	// Fallback: check if notes contain folder/filename information from previous imports
	if (track.notes?.startsWith('Imported from: ')) {
		const filename = track.notes.replace('Imported from: ', '').trim();
		const musicDir = getMusicDirectory();

		// Check common direct locations or search folder
		const directPath = path.join(musicDir, filename);
		if (fs.existsSync(directPath)) return directPath;
	}

	return null;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const trackId = parseInt(params.id, 10);
	if (isNaN(trackId)) {
		return json({ error: 'Invalid track ID' }, { status: 400 });
	}

	const track = getTrackById(trackId);
	if (!track) {
		return json({ error: 'Track not found' }, { status: 404 });
	}

	const filePath = resolveTrackFilePath(track);
	if (!filePath) {
		return json(
			{ error: 'No local audio file path is registered for this track on the server.' },
			{ status: 404 }
		);
	}

	const musicDir = getMusicDirectory();
	let canonicalMusicDir: string;
	try {
		canonicalMusicDir = fs.existsSync(musicDir) ? fs.realpathSync(musicDir) : path.resolve(musicDir);
	} catch {
		canonicalMusicDir = path.resolve(musicDir);
	}

	let canonicalFilePath: string;
	try {
		canonicalFilePath = fs.realpathSync(filePath);
	} catch {
		return json({ error: 'Audio file not found on disk' }, { status: 404 });
	}

	if (!isPathWithin(canonicalFilePath, canonicalMusicDir) && canonicalFilePath !== canonicalMusicDir) {
		return json({ error: 'Access denied: File outside music directory' }, { status: 403 });
	}

	let stat: fs.Stats;
	try {
		stat = fs.statSync(canonicalFilePath);
	} catch {
		return json({ error: 'Cannot read file metadata' }, { status: 404 });
	}

	const ext = path.extname(canonicalFilePath).toLowerCase();
	const contentType = MIME_MAP[ext] || 'audio/mpeg';
	const fileSize = stat.size;

	const rangeHeader = request.headers.get('range');
	if (rangeHeader) {
		const parts = rangeHeader.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

		if (start >= fileSize || end >= fileSize || start > end) {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${fileSize}` }
			});
		}

		const chunkSize = end - start + 1;
		const stream = fs.createReadStream(canonicalFilePath, { start, end });
		const webStream = Readable.toWeb(stream) as ReadableStream;

		return new Response(webStream, {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(),
				'Content-Type': contentType,
				'Cache-Control': 'no-cache'
			}
		});
	}

	const stream = fs.createReadStream(canonicalFilePath);
	const webStream = Readable.toWeb(stream) as ReadableStream;

	return new Response(webStream, {
		status: 200,
		headers: {
			'Accept-Ranges': 'bytes',
			'Content-Length': fileSize.toString(),
			'Content-Type': contentType,
			'Cache-Control': 'no-cache'
		}
	});
};
