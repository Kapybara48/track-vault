import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getMusicBrainzRelease } from '$lib/server/musicbrainz.js';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!id) return json({ error: 'Release ID is required' }, { status: 400 });

	try {
		const release = await getMusicBrainzRelease(id);
		if (!release) {
			return json({ error: 'Release not found in MusicBrainz' }, { status: 404 });
		}
		return json(release);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
