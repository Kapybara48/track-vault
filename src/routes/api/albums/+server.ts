import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAlbums, createAlbum } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ url }) => {
	const search = url.searchParams.get('q') || undefined;
	const filter = url.searchParams.get('filter') || undefined;

	try {
		const albums = getAlbums(search, filter);
		return json(albums);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { album, tracks } = body;

		if (!album || !album.title || !album.artist) {
			return json({ error: 'Album title and artist are required' }, { status: 400 });
		}

		const albumId = createAlbum(album, tracks || []);
		return json({ success: true, id: albumId });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
