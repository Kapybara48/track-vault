import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { updateAlbumFixerRules } from '$lib/server/db.js';
import type { FixerRules } from '$lib/types/index.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) return json({ error: 'Invalid album ID' }, { status: 400 });

	try {
		const body = await request.json();
		const rules: FixerRules = body.rules || {};
		const applyToAll: boolean = !!body.applyToAll;

		const result = updateAlbumFixerRules(id, rules, applyToAll);
		if (!result) {
			return json({ error: 'Album not found' }, { status: 404 });
		}
		return json({ success: true, ...result });
	} catch (err: any) {
		console.error('Failed to update album fixer rules:', err);
		return json({ error: err.message || 'Failed to update fixer rules' }, { status: 500 });
	}
};
