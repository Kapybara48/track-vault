import { json, type RequestHandler } from '@sveltejs/kit';
import { authenticateUser, createSession, hasAnyUser } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const usersExist = hasAnyUser();
	if (!usersExist) {
		return json({ error: 'System uninitialized. Please complete initial setup first.', redirect: '/setup' }, { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON request' }, { status: 400 });
	}

	const username = body.username?.toString().trim();
	const password = body.password?.toString();
	const redirectTo = body.redirectTo || url.searchParams.get('redirect') || '/';

	if (!username || !password) {
		return json({ error: 'Username and password are required' }, { status: 400 });
	}

	const user = authenticateUser(username, password);
	if (!user) {
		return json({ error: 'Invalid username or password' }, { status: 401 });
	}

	const sessionId = createSession(user.id);
	cookies.set('vault_session', sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.COOKIE_SECURE === 'true',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});

	return json({ success: true, redirect: redirectTo });
};
