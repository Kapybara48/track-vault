import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { searchMusicBrainz } from '$lib/server/musicbrainz.js';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || !query.trim()) {
		return json([]);
	}

	try {
		const results = await searchMusicBrainz(query);
		return json(results);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
