import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { searchMusicBrainz } from '$lib/server/musicbrainz.js';

export const GET: RequestHandler = async ({ url }) => {
	const rawQuery = url.searchParams.get('q') || '';
	const rawArtist = url.searchParams.get('artist') || '';

	// Limit length to prevent abusive/oversized requests
	const query = rawQuery.trim().slice(0, 200);
	const artist = rawArtist.trim().slice(0, 200);

	if (!query && !artist) {
		return json([]);
	}

	try {
		const results = await searchMusicBrainz(query, artist || undefined);
		return json(results);
	} catch (err: any) {
		console.error('MusicBrainz search error:', err);
		return json({ error: err.message || 'Failed to search MusicBrainz' }, { status: 500 });
	}
};
