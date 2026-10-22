import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { batchUpdateAlbumTracks } from '$lib/server/db.js';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const albumId = parseInt(params.id, 10);
	if (isNaN(albumId)) return json({ error: 'Invalid album ID' }, { status: 400 });

	try {
		const updates = await request.json();
		batchUpdateAlbumTracks(albumId, updates);
		return json({ success: true });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
