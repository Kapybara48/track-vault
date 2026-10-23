import { json, type RequestHandler } from '@sveltejs/kit';
import { hasAnyUser, createInitialAdmin, createSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const usersExist = hasAnyUser();
	if (usersExist) {
		return json({ error: 'Administrator account already exists. Please log in.' }, { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON request' }, { status: 400 });
	}

	const username = body.username?.toString().trim();
	const password = body.password?.toString();
	const confirmPassword = body.confirmPassword?.toString();

	if (!username || username.length < 3) {
		return json({ error: 'Username must be at least 3 characters long' }, { status: 400 });
	}

	if (!password || password.length < 6) {
		return json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
	}

	if (password !== confirmPassword) {
		return json({ error: 'Passwords do not match' }, { status: 400 });
	}

	try {
		const user = createInitialAdmin(username, password);
		const sessionId = createSession(user.id);

		cookies.set('vault_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.COOKIE_SECURE === 'true',
			maxAge: 30 * 24 * 60 * 60 // 30 days
		});

		return json({ success: true, redirect: '/' });
	} catch (err: any) {
		console.error('Failed to create initial admin:', err);
		return json({ error: err.message || 'Failed to create administrator account' }, { status: 500 });
	}
};
