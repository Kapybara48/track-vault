import type { PageServerLoad } from './$types.js';
import { db, getAlbums } from '$lib/server/db.js';
import type { Album, Track } from '$lib/types/index.js';

export interface PlayerAlbum extends Album {
	tracks: Track[];
}

export const load: PageServerLoad = async ({ url }) => {
	const initialAlbumId = url.searchParams.get('albumId') ? parseInt(url.searchParams.get('albumId')!, 10) : null;
	const initialTrackId = url.searchParams.get('trackId') ? parseInt(url.searchParams.get('trackId')!, 10) : null;

	// Fetch all albums
	const rawAlbums = getAlbums();

	// Fetch all tracks with album details
	const allTracks = db.prepare(`
		SELECT 
			t.*,
			a.title as album_title,
			a.artist as album_artist,
			a.cover_url as album_cover_url,
			a.release_year as album_year
		FROM tracks t
		JOIN albums a ON a.id = t.album_id
		ORDER BY a.artist COLLATE NOCASE ASC, a.release_year ASC, a.title COLLATE NOCASE ASC, t.disc_number ASC, t.track_number ASC
	`).all() as Track[];

	// Group tracks by album_id
	const tracksByAlbum = new Map<number, Track[]>();
	for (const tr of allTracks) {
		const existing = tracksByAlbum.get(tr.album_id) || [];
		existing.push(tr);
		tracksByAlbum.set(tr.album_id, existing);
	}

	const albums: PlayerAlbum[] = rawAlbums.map((alb) => ({
		...alb,
		tracks: tracksByAlbum.get(alb.id) || []
	}));

	return {
		albums,
		allTracks,
		initialAlbumId,
		initialTrackId
	};
};
