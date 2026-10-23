import { json, type RequestHandler } from '@sveltejs/kit';
import { changePassword } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
	}

	if (locals.authDisabled) {
		return json({ error: 'Authentication is globally disabled in this environment (AUTH_DISABLED=true).' }, { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON request' }, { status: 400 });
	}

	const currentPassword = body.currentPassword?.toString();
	const newPassword = body.newPassword?.toString();
	const confirmPassword = body.confirmPassword?.toString();

	if (!currentPassword || !newPassword) {
		return json({ error: 'Current password and new password are required' }, { status: 400 });
	}

	if (newPassword !== confirmPassword) {
		return json({ error: 'New passwords do not match' }, { status: 400 });
	}

	if (newPassword.length < 6) {
		return json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
	}

	const result = changePassword(locals.user.id, currentPassword, newPassword);
	if (!result.success) {
		return json({ error: result.error || 'Failed to update password' }, { status: 400 });
	}

	return json({ success: true, message: 'Password successfully updated' });
};
