import { json, redirect, type RequestHandler } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const sessionId = cookies.get('vault_session');
	if (sessionId) {
		deleteSession(sessionId);
		cookies.delete('vault_session', { path: '/' });
	}

	const isJson =
		request.headers.get('content-type')?.includes('application/json') ||
		request.headers.get('accept')?.includes('application/json');

	if (isJson) {
		return json({ success: true, redirect: '/login' });
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
