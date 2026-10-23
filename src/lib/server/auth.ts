import crypto from 'node:crypto';
import { db } from '$lib/server/db.js';

export interface User {
	id: number;
	username: string;
	role: string;
	created_at?: string;
}

export function isAuthDisabled(): boolean {
	const val = process.env.AUTH_DISABLED || process.env.DISABLE_AUTH;
	return val === 'true' || val === '1';
}

/**
 * Hash password using Node's built-in scrypt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
	const salt = crypto.randomBytes(16).toString('hex');
	const hash = crypto.scryptSync(password, salt, 64).toString('hex');
	return { hash, salt };
}

/**
 * Verify password against stored hash and salt
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
	const hash = crypto.scryptSync(password, salt, 64).toString('hex');
	return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Check if at least one user exists in the SQLite database
 */
export function hasAnyUser(): boolean {
	if (isAuthDisabled()) return true;
	try {
		const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
		return (row?.count || 0) > 0;
	} catch {
		return false;
	}
}

/**
 * Create initial admin user on first run
 */
export function createInitialAdmin(username: string, password: string): User {
	const trimmedUser = username.trim().toLowerCase();
	const { hash, salt } = hashPassword(password);

	const result = db.prepare(`
		INSERT INTO users (username, password_hash, salt, role)
		VALUES (?, ?, ?, 'admin')
	`).run(trimmedUser, hash, salt);

	return {
		id: Number(result.lastInsertRowid),
		username: trimmedUser,
		role: 'admin'
	};
}

/**
 * Authenticate user with username and password
 */
export function authenticateUser(username: string, password: string): User | null {
	const trimmedUser = username.trim().toLowerCase();
	const row = db.prepare(
		'SELECT id, username, password_hash, salt, role FROM users WHERE username = ?'
	).get(trimmedUser) as any;

	if (!row) {
		return null;
	}

	const isValid = verifyPassword(password, row.password_hash, row.salt);
	if (!isValid) {
		return null;
	}

	return {
		id: row.id,
		username: row.username,
		role: row.role
	};
}

/**
 * Create a new session for a user (valid for 30 days)
 */
export function createSession(userId: number): string {
	const sessionId = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		sessionId,
		userId,
		expiresAt
	);

	return sessionId;
}

/**
 * Validate session token and return user if valid
 */
export function validateSession(sessionId: string): User | null {
	if (!sessionId) return null;

	const now = new Date().toISOString();
	const row = db.prepare(`
		SELECT u.id, u.username, u.role, s.expires_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.id = ? AND s.expires_at > ?
	`).get(sessionId, now) as any;

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		username: row.username,
		role: row.role
	};
}

/**
 * Invalidate a session (logout)
 */
export function deleteSession(sessionId: string): void {
	if (!sessionId) return;
	db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
