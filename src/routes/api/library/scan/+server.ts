import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { scanLibraryDirectory, getMusicDirectory } from '$lib/server/scanner.js';

export const GET: RequestHandler = async ({ url }) => {
	const customPath = url.searchParams.get('path') || undefined;

	try {
		const result = await scanLibraryDirectory(customPath);
		return json(result);
	} catch (err: any) {
		console.error('Library scan error:', err);
		return json(
			{
				error: err.message,
				albums: [],
				totalFiles: 0,
				libraryPath: customPath || getMusicDirectory(),
				exists: false
			},
			{ status: 500 }
		);
	}
};
