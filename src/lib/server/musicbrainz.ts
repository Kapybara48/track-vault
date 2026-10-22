import type {
	MusicBrainzReleaseItem,
	MusicBrainzReleaseDetail,
	MusicBrainzReleaseTrack
} from '$lib/types/index.js';

const USER_AGENT = 'TrackVault/1.0.0 ( mailto:daniel.krejci44@gmail.com )';
let lastRequestTime = 0;

/**
 * Throttle requests to respect MusicBrainz rate limit (1 request/sec)
 */
async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;
	if (elapsed < 1100) {
		await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
	}
	lastRequestTime = Date.now();

	return fetch(url, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json'
		}
	});
}

/**
 * Search MusicBrainz for releases matching a query
 */
export async function searchMusicBrainz(query: string): Promise<MusicBrainzReleaseItem[]> {
	if (!query || !query.trim()) return [];

	// Clean up query
	const cleanQuery = query.trim();
	// If query has no special syntax, search by release title or artist
	const encoded = encodeURIComponent(cleanQuery);
	const url = `https://musicbrainz.org/ws/2/release/?query=${encoded}&fmt=json&limit=15`;

	try {
		const res = await rateLimitedFetch(url);
		if (!res.ok) {
			console.error(`MusicBrainz search error: ${res.status} ${res.statusText}`);
			return [];
		}

		const data = await res.json();
		if (!data.releases || !Array.isArray(data.releases)) {
			return [];
		}

		return data.releases.map((rel: any): MusicBrainzReleaseItem => {
			const artist = rel['artist-credit']
				? rel['artist-credit'].map((a: any) => (typeof a === 'string' ? a : a.name)).join('')
				: 'Unknown Artist';

			const year = rel.date ? parseInt(rel.date.substring(0, 4), 10) : null;
			const mediaFormat = rel.media?.[0]?.format || 'Digital';
			const trackCount = rel['track-count'] || rel.media?.reduce((acc: number, m: any) => acc + (m['track-count'] || 0), 0) || 0;

			// If front cover is flagged in cover-art-archive, direct link works
			const hasCover = rel['cover-art-archive']?.front || rel['cover-art-archive']?.artwork;
			const coverUrl = hasCover ? `https://coverartarchive.org/release/${rel.id}/front-250` : null;

			return {
				id: rel.id,
				title: rel.title,
				artist,
				date: rel.date,
				year: isNaN(year!) ? null : year,
				country: rel.country,
				track_count: trackCount,
				media_format: mediaFormat,
				cover_url: coverUrl,
				disambiguation: rel.disambiguation
			};
		});
	} catch (err) {
		console.error('Failed to search MusicBrainz:', err);
		return [];
	}
}

/**
 * Fetch full release tracklist and details from MusicBrainz
 */
export async function getMusicBrainzRelease(releaseId: string): Promise<MusicBrainzReleaseDetail | null> {
	if (!releaseId) return null;

	const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artists+media+labels&fmt=json`;

	try {
		const res = await rateLimitedFetch(url);
		if (!res.ok) {
			console.error(`MusicBrainz release fetch error: ${res.status} ${res.statusText}`);
			return null;
		}

		const rel = await res.json();
		const artist = rel['artist-credit']
			? rel['artist-credit'].map((a: any) => (typeof a === 'string' ? a : a.name)).join('')
			: 'Unknown Artist';

		const year = rel.date ? parseInt(rel.date.substring(0, 4), 10) : null;
		const mediaType = rel.media?.[0]?.format || 'Digital';

		const tracks: MusicBrainzReleaseTrack[] = [];

		if (rel.media && Array.isArray(rel.media)) {
			let discIdx = 1;
			for (const media of rel.media) {
				const discNumber = media.position || discIdx++;
				if (media.tracks && Array.isArray(media.tracks)) {
					for (const tr of media.tracks) {
						const trArtist = tr['artist-credit']
							? tr['artist-credit'].map((a: any) => (typeof a === 'string' ? a : a.name)).join('')
							: artist;

						const trackNum = parseInt(tr.number || `${tr.position}`, 10) || tr.position || tracks.length + 1;

						tracks.push({
							id: tr.id || `${discNumber}-${trackNum}`,
							disc_number: discNumber,
							track_number: trackNum,
							title: tr.title || tr.recording?.title || `Track ${trackNum}`,
							artist: trArtist !== artist ? trArtist : artist,
							duration_ms: tr.length || tr.recording?.length || null
						});
					}
				}
			}
		}

		// Check if cover art exists from Cover Art Archive
		const hasCover = rel['cover-art-archive']?.front || rel['cover-art-archive']?.artwork;
		const coverUrl = hasCover ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;

		return {
			id: rel.id,
			title: rel.title,
			artist,
			release_year: isNaN(year!) ? null : year,
			cover_url: coverUrl,
			media_type: mediaType,
			tracks
		};
	} catch (err) {
		console.error(`Failed to get MusicBrainz release ${releaseId}:`, err);
		return null;
	}
}
