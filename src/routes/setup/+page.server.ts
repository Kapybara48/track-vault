import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import {
	hasAnyUser,
	createInitialAdmin,
	createSession,
	isAuthDisabled,
	getSessionCookieOptions,
	SESSION_COOKIE_NAME
} from '$lib/server/auth.js';

export const load: PageServerLoad = async () => {
	if (isAuthDisabled()) {
		throw redirect(303, '/');
	}

	const usersExist = hasAnyUser();
	if (usersExist) {
		throw redirect(303, '/login');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const usersExist = hasAnyUser();
		if (usersExist) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const username = data.get('username')?.toString().trim();
		const password = data.get('password')?.toString();
		const confirmPassword = data.get('confirmPassword')?.toString();

		if (!username || username.length < 3) {
			return fail(400, {
				error: 'Username must be at least 3 characters long',
				username
			});
		}

		if (!password || password.length < 6) {
			return fail(400, {
				error: 'Password must be at least 6 characters long',
				username
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				error: 'Passwords do not match',
				username
			});
		}

		try {
			const user = createInitialAdmin(username, password);
			const sessionId = createSession(user.id);

			cookies.set(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions(url));
		} catch (err: any) {
			console.error('Failed to create admin:', err);
			return fail(500, {
				error: err.message || 'Failed to create administrator account',
				username
			});
		}

		throw redirect(303, '/');
	}
};
