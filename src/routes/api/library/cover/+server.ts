import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types.js';
import { getMusicDirectory } from '$lib/server/scanner.js';

const ALLOWED_EXTENSIONS = new Map<string, string>([
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.png', 'image/png'],
	['.webp', 'image/webp'],
	['.gif', 'image/gif'],
	['.bmp', 'image/bmp']
]);

const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function isPathWithin(targetPath: string, rootPath: string): boolean {
	const relative = path.relative(rootPath, targetPath);
	return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export const GET: RequestHandler = async ({ url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) {
		return new Response('File path required', { status: 400 });
	}

	const resolved = path.resolve(filePath);
	if (!fs.existsSync(resolved)) {
		return new Response('Cover art not found', { status: 404 });
	}

	let canonicalTarget: string;
	try {
		canonicalTarget = fs.realpathSync(resolved);
	} catch {
		return new Response('Invalid file path', { status: 400 });
	}

	// Authorized directories: configured music dir and data dir
	const musicDir = getMusicDirectory();
	const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve('./data');

	let canonicalMusicDir: string;
	try {
		canonicalMusicDir = fs.existsSync(musicDir) ? fs.realpathSync(musicDir) : path.resolve(musicDir);
	} catch {
		canonicalMusicDir = path.resolve(musicDir);
	}

	let canonicalDataDir: string;
	try {
		canonicalDataDir = fs.existsSync(dataDir) ? fs.realpathSync(dataDir) : path.resolve(dataDir);
	} catch {
		canonicalDataDir = path.resolve(dataDir);
	}

	const isAllowed =
		isPathWithin(canonicalTarget, canonicalMusicDir) ||
		isPathWithin(canonicalTarget, canonicalDataDir) ||
		canonicalTarget === canonicalMusicDir ||
		canonicalTarget === canonicalDataDir;

	if (!isAllowed) {
		return new Response('Access denied: File outside authorized music or data directories', {
			status: 403
		});
	}

	// Strictly enforce image extensions
	const ext = path.extname(canonicalTarget).toLowerCase();
	const contentType = ALLOWED_EXTENSIONS.get(ext);
	if (!contentType) {
		return new Response('Invalid file type: Only image files are permitted', { status: 400 });
	}

	try {
		const stat = fs.statSync(canonicalTarget);
		if (!stat.isFile()) {
			return new Response('Target is not a file', { status: 400 });
		}
		if (stat.size > MAX_IMAGE_SIZE_BYTES) {
			return new Response('Image file exceeds 25MB limit', { status: 413 });
		}

		const buffer = fs.readFileSync(canonicalTarget);
		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Content-Length': stat.size.toString(),
				'Cache-Control': 'public, max-age=86400',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (err: any) {
		console.error('Failed to read cover image:', err);
		return new Response('Failed to read cover image', { status: 500 });
	}
};
