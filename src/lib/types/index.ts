export type AudioFormat =
	| 'FLAC'
	| 'ALAC'
	| 'WAV'
	| 'AIFF'
	| 'MP3_320'
	| 'MP3_V0'
	| 'MP3_192'
	| 'MP3_128'
	| 'AAC_256'
	| 'OGG'
	| 'OTHER';

export type QualityRating =
	| 'perfect'      // Studio / lossless original
	| 'good'         // High quality encode (e.g. 320/V0 or clean lossless)
	| 'acceptable'   // Listen-able but could be better
	| 'bad'          // Transcode, bad rip, audible distortion
	| 'needs_upgrade';// Explicitly flagged for replacement

export type CensorshipStatus =
	| 'explicit'       // Original explicit version
	| 'clean_original' // Track is inherently clean (not censored)
	| 'censored'       // Radio edit / bleeped - wants uncensored replacement
	| 'instrumental';  // No vocals

export type LyricsStatus =
	| 'synced_lrc'    // Synced time-coded .lrc
	| 'plain_txt'     // Plain unsynced text
	| 'missing'       // Missing lyrics
	| 'instrumental'; // No lyrics needed

export interface Album {
	id: number;
	musicbrainz_id: string | null;
	title: string;
	artist: string;
	release_year: number | null;
	genre: string | null;
	cover_url: string | null;
	media_type: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	// Computed / joined fields
	track_count?: number;
	bad_quality_count?: number;
	censored_count?: number;
	missing_lyrics_count?: number;
}

export interface Track {
	id: number;
	album_id: number;
	disc_number: number;
	track_number: number;
	title: string;
	artist: string | null;
	duration_ms: number | null;
	format: AudioFormat;
	quality_rating: QualityRating;
	censorship: CensorshipStatus;
	lyrics: LyricsStatus;
	needs_attention: number; // 0 or 1
	notes: string | null;
	created_at: string;
	updated_at: string;
	// Joined album info
	album_title?: string;
	album_artist?: string;
	album_cover_url?: string | null;
	album_year?: number | null;
}

export interface CollectionStats {
	total_albums: number;
	total_tracks: number;
	flac_count: number;
	mp3_count: number;
	other_format_count: number;
	bad_quality_count: number;
	censored_count: number;
	missing_lyrics_count: number;
	synced_lyrics_count: number;
	plain_lyrics_count: number;
	total_needs_attention: number;
	health_score: number; // 0 - 100%
}

export interface MusicBrainzReleaseItem {
	id: string;
	title: string;
	artist: string;
	date?: string;
	year?: number | null;
	country?: string;
	track_count?: number;
	media_format?: string;
	cover_url?: string | null;
	disambiguation?: string;
}

export interface MusicBrainzReleaseTrack {
	id: string;
	disc_number: number;
	track_number: number;
	title: string;
	artist: string;
	duration_ms: number | null;
}

export interface MusicBrainzReleaseDetail {
	id: string;
	title: string;
	artist: string;
	release_year: number | null;
	genre?: string | null;
	cover_url: string | null;
	media_type: string | null;
	tracks: MusicBrainzReleaseTrack[];
}
