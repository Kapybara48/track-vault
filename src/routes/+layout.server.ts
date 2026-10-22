import type { LayoutServerLoad } from './$types.js';
import { getStats } from '$lib/server/db.js';

export const load: LayoutServerLoad = async () => {
	const stats = getStats();
	return {
		stats
	};
};
