import type { PageServerLoad } from './$types.js';
import { getAlbums, getStats } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') || undefined;
	const filter = url.searchParams.get('filter') || undefined;

	const albums = getAlbums(search, filter);
	const stats = getStats();

	return {
		albums,
		stats,
		searchQuery: search || '',
		activeFilter: filter || 'all'
	};
};
