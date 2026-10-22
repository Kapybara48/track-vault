import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { importScannedAlbum } from '$lib/server/scanner.js';
import type { ScannedAlbum } from '$lib/types/index.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { album, selectedTrackPaths } = body as {
			album: ScannedAlbum;
			selectedTrackPaths?: string[];
		};

		if (!album) {
			return json({ error: 'Album data is required' }, { status: 400 });
		}

		const albumId = await importScannedAlbum(album, selectedTrackPaths);
		return json({ success: true, albumId });
	} catch (err: any) {
		console.error('Import error:', err);
		return json({ error: err.message }, { status: 500 });
	}
};
