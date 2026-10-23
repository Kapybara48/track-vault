import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { updateTrack, deleteTrack, getTrackById } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) return json({ error: 'Invalid track ID' }, { status: 400 });

	const track = getTrackById(id);
	if (!track) return json({ error: 'Track not found' }, { status: 404 });

	return json({ success: true, track });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) return json({ error: 'Invalid track ID' }, { status: 400 });

	try {
		const updates = await request.json();
		const updatedTrack = updateTrack(id, updates);
		return json({ success: true, track: updatedTrack });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) return json({ error: 'Invalid track ID' }, { status: 400 });

	try {
		deleteTrack(id);
		return json({ success: true });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
