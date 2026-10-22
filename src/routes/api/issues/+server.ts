import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getIssuesTracks } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ url }) => {
	const issueType = url.searchParams.get('type') || undefined;
	const format = url.searchParams.get('format') || undefined;
	const censorship = url.searchParams.get('censorship') || undefined;
	const lyrics = url.searchParams.get('lyrics') || undefined;
	const search = url.searchParams.get('q') || undefined;
	const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
	const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined;

	try {
		const result = getIssuesTracks({
			issueType,
			format,
			censorship,
			lyrics,
			search,
			limit,
			offset
		});
		return json(result);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
