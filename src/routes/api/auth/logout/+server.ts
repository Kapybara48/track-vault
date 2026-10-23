import { redirect, type RequestHandler } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('vault_session');
	if (sessionId) {
		deleteSession(sessionId);
		cookies.delete('vault_session', { path: '/' });
	}

	throw redirect(303, '/login');
};

export const GET: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('vault_session');
	if (sessionId) {
		deleteSession(sessionId);
		cookies.delete('vault_session', { path: '/' });
	}

	throw redirect(303, '/login');
};
