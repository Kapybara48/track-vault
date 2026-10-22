import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStats } from '$lib/server/db.js';

export const GET: RequestHandler = async () => {
	try {
		const stats = getStats();
		return json(stats);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
