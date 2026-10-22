import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { searchMusicBrainz } from '$lib/server/musicbrainz.js';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const artist = url.searchParams.get('artist') || '';

	if (!query.trim() && !artist.trim()) {
		return json([]);
	}

	try {
		const results = await searchMusicBrainz(query, artist || undefined);
		return json(results);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
