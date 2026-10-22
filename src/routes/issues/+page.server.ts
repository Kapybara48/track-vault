import type { PageServerLoad } from './$types.js';
import { getIssuesTracks, getStats } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ url }) => {
	const issueType = url.searchParams.get('type') || 'all_issues';
	const format = url.searchParams.get('format') || undefined;
	const search = url.searchParams.get('q') || undefined;

	const { tracks, total } = getIssuesTracks({
		issueType,
		format,
		search,
		limit: 100
	});

	const stats = getStats();

	return {
		tracks,
		total,
		stats,
		activeType: issueType,
		searchQuery: search || '',
		formatFilter: format || ''
	};
};
