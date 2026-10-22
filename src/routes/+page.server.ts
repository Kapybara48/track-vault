import type { PageServerLoad } from './$types.js';
import { getAlbums, getStats, searchVaultTracks } from '$lib/server/db.js';
import { parseSearchQuery } from '$lib/search.js';
import type { SearchFilters } from '$lib/types/index.js';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') || undefined;
	const filter = url.searchParams.get('filter') || undefined;
	const format = url.searchParams.get('format') || undefined;
	const notFormat = url.searchParams.get('notFormat') || undefined;
	const censorship = url.searchParams.get('censor') || undefined;
	const notCensorship = url.searchParams.get('notCensor') || undefined;
	const lyrics = url.searchParams.get('lyrics') || undefined;
	const notLyrics = url.searchParams.get('notLyrics') || undefined;
	const quality = url.searchParams.get('quality') || undefined;
	const view = (url.searchParams.get('view') || 'albums') as 'albums' | 'tracks';

	const options: SearchFilters = {
		filter,
		format: format && format !== 'all' ? format : undefined,
		notFormat: notFormat || undefined,
		censorship: censorship && censorship !== 'all' ? censorship : undefined,
		notCensorship: notCensorship || undefined,
		lyrics: lyrics && lyrics !== 'all' ? lyrics : undefined,
		notLyrics: notLyrics || undefined,
		quality: quality && quality !== 'all' ? quality : undefined
	};

	// If format starts with !, e.g. format="!FLAC"
	if (format && format.startsWith('!')) {
		options.notFormat = format.substring(1);
		options.format = undefined;
	}
	if (censorship && censorship.startsWith('!')) {
		options.notCensorship = censorship.substring(1);
		options.censorship = undefined;
	}
	if (lyrics && lyrics.startsWith('!')) {
		options.notLyrics = lyrics.substring(1);
		options.lyrics = undefined;
	}

	const albums = getAlbums(search, filter, options);
	const { tracks: matchingTracks, total: totalMatchingTracks } = searchVaultTracks(search, options, 200, 0);
	const stats = getStats();

	return {
		albums,
		matchingTracks,
		totalMatchingTracks,
		stats,
		searchQuery: search || '',
		activeFilter: filter || 'all',
		activeFormat: format || '',
		activeCensorship: censorship || '',
		activeLyrics: lyrics || '',
		activeQuality: quality || '',
		activeView: view
	};
};
