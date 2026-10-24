import type { LayoutServerLoad } from './$types.js';
import { getStats } from '$lib/server/db.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const stats = getStats();
	const defaultPicardUrl = `http://${url.hostname || 'localhost'}:5800`;
	return {
		stats,
		user: locals.user || null,
		authDisabled: locals.authDisabled || false,
		picardUrl: process.env.PICARD_URL || defaultPicardUrl
	};
};
