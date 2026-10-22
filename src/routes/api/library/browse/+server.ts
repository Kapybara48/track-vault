import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import fs from 'node:fs';
import path from 'node:path';

export const GET: RequestHandler = async ({ url }) => {
	const rawPath = url.searchParams.get('path')?.trim() || '';

	const quickSuggestions = ['/music', './music', '/app/music', '/home', '/mnt', '/media'];
	const validQuick = quickSuggestions.filter((p) => {
		try {
			return fs.existsSync(p) && fs.statSync(p).isDirectory();
		} catch {
			return false;
		}
	});

	if (!rawPath) {
		return json({
			suggestions: validQuick,
			exists: false,
			isDirectory: false
		});
	}

	let targetExists = false;
	let isDir = false;
	try {
		if (fs.existsSync(rawPath)) {
			targetExists = true;
			isDir = fs.statSync(rawPath).isDirectory();
		}
	} catch {
		targetExists = false;
		isDir = false;
	}

	let lookupDir: string;
	let prefix: string;

	if (rawPath.endsWith('/') || rawPath.endsWith(path.sep)) {
		lookupDir = rawPath;
		prefix = '';
	} else if (targetExists && isDir) {
		lookupDir = rawPath;
		prefix = '';
	} else {
		lookupDir = path.dirname(rawPath);
		prefix = path.basename(rawPath).toLowerCase();
	}

	const suggestions: string[] = [];

	try {
		if (fs.existsSync(lookupDir) && fs.statSync(lookupDir).isDirectory()) {
			const entries = fs.readdirSync(lookupDir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				// Skip hidden dirs unless prefix starts with dot
				if (entry.name.startsWith('.') && !prefix.startsWith('.')) continue;

				if (!prefix || entry.name.toLowerCase().startsWith(prefix) || entry.name.toLowerCase().includes(prefix)) {
					const fullPath = path.resolve(lookupDir, entry.name);
					suggestions.push(fullPath);
				}
			}

			// Sort suggestions: exact start with prefix first, then alphabetical
			suggestions.sort((a, b) => {
				const nameA = path.basename(a).toLowerCase();
				const nameB = path.basename(b).toLowerCase();
				const aStarts = nameA.startsWith(prefix);
				const bStarts = nameB.startsWith(prefix);
				if (aStarts && !bStarts) return -1;
				if (!aStarts && bStarts) return 1;
				return nameA.localeCompare(nameB);
			});
		}
	} catch (err) {
		// Ignore filesystem permission errors gracefully
	}

	// Always add the typed path if it is a directory and not already first
	if (targetExists && isDir && !suggestions.includes(path.resolve(rawPath))) {
		suggestions.unshift(path.resolve(rawPath));
	}

	return json({
		suggestions: suggestions.slice(0, 20),
		exists: targetExists,
		isDirectory: isDir,
		quickPaths: validQuick
	});
};
