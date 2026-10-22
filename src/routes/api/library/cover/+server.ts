import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) {
		return new Response('File path required', { status: 400 });
	}

	const resolved = path.resolve(filePath);
	if (!fs.existsSync(resolved)) {
		return new Response('Cover art not found', { status: 404 });
	}

	const ext = path.extname(resolved).toLowerCase();
	let contentType = 'image/jpeg';
	if (ext === '.png') contentType = 'image/png';
	else if (ext === '.webp') contentType = 'image/webp';

	try {
		const buffer = fs.readFileSync(resolved);
		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} catch (err: any) {
		return new Response('Failed to read cover', { status: 500 });
	}
};
