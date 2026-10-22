<script lang="ts">
	import type { PageData } from './$types.js';
	import type { Track, AudioFormat, QualityRating, CensorshipStatus, LyricsStatus } from '$lib/types/index.js';
	import TrackRow from '$lib/components/TrackRow.svelte';
	import { formatDuration, FORMAT_OPTIONS, QUALITY_OPTIONS, CENSORSHIP_OPTIONS, LYRICS_OPTIONS } from '$lib/utils.js';
	import {
		Disc,
		Disc3,
		Pencil,
		Trash2,
		Plus,
		Layers,
		CheckCircle2,
		AlertTriangle,
		ArrowLeft,
		Music,
		ExternalLink,
		X
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let tracks = $state<Track[]>([...data.tracks]);
	let album = $state({ ...data.album });

	// Keep state updated if data changes
	$effect(() => {
		tracks = [...data.tracks];
		album = { ...data.album };
	});

	// Modals and dialogs
	let showBatchModal = $state(false);
	let showEditAlbumModal = $state(false);
	let showAddTrackModal = $state(false);
	let filterIssuesOnly = $state(false);

	// Batch update form state
	let batchFormat = $state<AudioFormat | ''>('');
	let batchQuality = $state<QualityRating | ''>('');
	let batchCensorship = $state<CensorshipStatus | ''>('');
	let batchLyrics = $state<LyricsStatus | ''>('');
	let isBatchSubmitting = $state(false);

	// Edit album form state
	let editTitle = $state(album.title);
	let editArtist = $state(album.artist);
	let editYear = $state(album.release_year ? `${album.release_year}` : '');
	let editGenre = $state(album.genre || '');
	let editCoverUrl = $state(album.cover_url || '');
	let editMediaType = $state(album.media_type || 'Digital');
	let editNotes = $state(album.notes || '');

	// Add track form state
	let newTrackTitle = $state('');
	let newTrackNumber = $state<number>(tracks.length + 1);
	let newTrackDisc = $state<number>(1);
	let newTrackArtist = $state('');
	let newTrackDuration = $state('');
	let newTrackFormat = $state<AudioFormat>('FLAC');
	let newTrackQuality = $state<QualityRating>('good');
	let newTrackCensorship = $state<CensorshipStatus>('clean_original');
	let newTrackLyrics = $state<LyricsStatus>('missing');

	// Calculations
	const totalDurationMs = $derived(
		tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0)
	);

	const badQualityCount = $derived(
		tracks.filter(t => t.quality_rating === 'bad' || t.quality_rating === 'needs_upgrade').length
	);

	const censoredCount = $derived(
		tracks.filter(t => t.censorship === 'censored').length
	);

	const missingLyricsCount = $derived(
		tracks.filter(t => t.lyrics === 'missing').length
	);

	const issuesCount = $derived(
		tracks.filter(t => t.needs_attention === 1).length
	);

	const displayedTracks = $derived(
		filterIssuesOnly ? tracks.filter(t => t.needs_attention === 1) : tracks
	);

	// Group tracks by disc number
	const discGroups = $derived.by(() => {
		const groups: { [disc: number]: Track[] } = {};
		for (const tr of displayedTracks) {
			const disc = tr.disc_number || 1;
			if (!groups[disc]) groups[disc] = [];
			groups[disc].push(tr);
		}
		return Object.entries(groups).map(([disc, trs]) => ({
			disc: parseInt(disc, 10),
			tracks: trs.sort((a, b) => a.track_number - b.track_number)
		})).sort((a, b) => a.disc - b.disc);
	});

	function handleTrackUpdated(updated: Track) {
		const idx = tracks.findIndex(t => t.id === updated.id);
		if (idx !== -1) {
			tracks[idx] = updated;
		}
	}

	function handleTrackDeleted(id: number) {
		tracks = tracks.filter(t => t.id !== id);
	}

	async function submitBatchUpdate() {
		isBatchSubmitting = true;
		try {
			const payload: any = {};
			if (batchFormat) payload.format = batchFormat;
			if (batchQuality) payload.quality_rating = batchQuality;
			if (batchCensorship) payload.censorship = batchCensorship;
			if (batchLyrics) payload.lyrics = batchLyrics;

			const res = await fetch(`/api/albums/${album.id}/batch`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				showBatchModal = false;
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to run batch update:', err);
		} finally {
			isBatchSubmitting = false;
		}
	}

	async function submitEditAlbum() {
		try {
			const yearNum = editYear.trim() ? parseInt(editYear.trim(), 10) : null;
			const res = await fetch(`/api/albums/${album.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle,
					artist: editArtist,
					release_year: isNaN(yearNum!) ? null : yearNum,
					genre: editGenre,
					cover_url: editCoverUrl,
					media_type: editMediaType,
					notes: editNotes
				})
			});

			if (res.ok) {
				showEditAlbumModal = false;
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to edit album:', err);
		}
	}

	async function submitAddTrack() {
		try {
			// Parse duration mm:ss to ms if provided
			let durationMs: number | null = null;
			if (newTrackDuration.trim()) {
				const parts = newTrackDuration.trim().split(':');
				if (parts.length === 2) {
					const min = parseInt(parts[0], 10);
					const sec = parseInt(parts[1], 10);
					if (!isNaN(min) && !isNaN(sec)) {
						durationMs = (min * 60 + sec) * 1000;
					}
				}
			}

			const res = await fetch(`/api/albums/${album.id}/tracks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: newTrackTitle,
					disc_number: newTrackDisc,
					track_number: newTrackNumber,
					artist: newTrackArtist || null,
					duration_ms: durationMs,
					format: newTrackFormat,
					quality_rating: newTrackQuality,
					censorship: newTrackCensorship,
					lyrics: newTrackLyrics
				})
			});

			if (res.ok) {
				showAddTrackModal = false;
				newTrackTitle = '';
				newTrackDuration = '';
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to add track:', err);
		}
	}

	async function handleDeleteAlbum() {
		if (!confirm(`Are you sure you want to delete album "${album.title}" and all its tracks?`)) {
			return;
		}

		try {
			const res = await fetch(`/api/albums/${album.id}`, { method: 'DELETE' });
			if (res.ok) {
				goto('/');
			}
		} catch (err) {
			console.error('Failed to delete album:', err);
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	<!-- Back Button -->
	<div class="mb-5">
		<a
			href="/"
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 transition hover:text-white"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Vault
		</a>
	</div>

	<!-- Album Hero Banner -->
	<div class="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-900/90 to-neutral-950 p-6 md:p-8 shadow-2xl">
		<div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
			<!-- Album Cover Art -->
			<div class="relative aspect-square w-48 sm:w-56 shrink-0 overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl border border-neutral-800">
				{#if album.cover_url}
					<img
						src={album.cover_url}
						alt={album.title}
						class="h-full w-full object-cover"
						onerror={(e) => {
							(e.currentTarget as HTMLElement).style.display = 'none';
						}}
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-600">
						<Disc class="h-20 w-20 opacity-30" />
					</div>
				{/if}

				{#if album.media_type}
					<span class="absolute bottom-3 left-3 rounded bg-black/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur-sm border border-white/10">
						{album.media_type}
					</span>
				{/if}
			</div>

			<!-- Album Metadata & Quick Info -->
			<div class="flex flex-1 flex-col justify-between self-stretch">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs font-bold uppercase tracking-widest text-purple-400">Album</span>
						{#if album.musicbrainz_id}
							<a
								href="https://musicbrainz.org/release/{album.musicbrainz_id}"
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 rounded bg-neutral-800/80 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-purple-300 border border-neutral-700/60"
								title="View on MusicBrainz"
							>
								<span>MusicBrainz</span>
								<ExternalLink class="h-3 w-3" />
							</a>
						{/if}
					</div>

					<h1 class="mt-2 text-2xl sm:text-4xl font-black tracking-tight text-white">
						{album.title}
					</h1>

					<p class="mt-1 text-lg font-semibold text-neutral-300">
						{album.artist}
					</p>

					<div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
						{#if album.release_year}
							<span class="font-medium text-neutral-300">{album.release_year}</span>
							<span>•</span>
						{/if}
						<span>{tracks.length} tracks</span>
						{#if totalDurationMs > 0}
							<span>•</span>
							<span>{formatDuration(totalDurationMs)}</span>
						{/if}
						{#if album.genre}
							<span>•</span>
							<span class="rounded bg-neutral-800/60 px-2 py-0.5 text-neutral-300 border border-neutral-700/40">
								{album.genre}
							</span>
						{/if}
					</div>

					{#if album.notes}
						<p class="mt-3 text-xs italic text-neutral-400 bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800/60">
							"{album.notes}"
						</p>
					{/if}
				</div>

				<!-- Issue Badges & Stats Bar -->
				<div class="mt-6 flex flex-wrap items-center gap-2 border-t border-neutral-800/60 pt-4">
					{#if issuesCount === 0}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-700">
							<CheckCircle2 class="h-4 w-4" />
							All Tracks Vault Ready
						</span>
					{:else}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-950/80 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-600">
							<AlertTriangle class="h-4 w-4" />
							{issuesCount} Tracks Need Attention
						</span>
					{/if}

					{#if badQualityCount > 0}
						<span class="rounded-lg bg-rose-950/70 px-2.5 py-1 text-xs font-medium text-rose-300 border border-rose-800">
							{badQualityCount} Bad Quality / Low Bitrate
						</span>
					{/if}

					{#if censoredCount > 0}
						<span class="rounded-lg bg-rose-950/70 px-2.5 py-1 text-xs font-medium text-rose-300 border border-rose-800">
							{censoredCount} Censored (Needs Uncensored)
						</span>
					{/if}

					{#if missingLyricsCount > 0}
						<span class="rounded-lg bg-amber-950/70 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-800">
							{missingLyricsCount} Missing Lyrics
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Action Bar at Bottom of Hero -->
		<div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800/80 pt-4">
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={() => (showBatchModal = true)}
					class="flex items-center gap-1.5 rounded-xl bg-purple-600/90 hover:bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow transition"
				>
					<Layers class="h-4 w-4" />
					Batch Update Tracks
				</button>

				<button
					type="button"
					onclick={() => (showAddTrackModal = true)}
					class="flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-3.5 py-2 text-xs font-semibold text-neutral-200 border border-neutral-700 transition"
				>
					<Plus class="h-4 w-4" />
					Add Track
				</button>

				<button
					type="button"
					onclick={() => (showEditAlbumModal = true)}
					class="flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-3.5 py-2 text-xs font-semibold text-neutral-200 border border-neutral-700 transition"
				>
					<Pencil class="h-3.5 w-3.5" />
					Edit Album
				</button>
			</div>

			<div class="flex items-center gap-2">
				<!-- Issues Only Toggle -->
				<button
					type="button"
					onclick={() => (filterIssuesOnly = !filterIssuesOnly)}
					class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition {filterIssuesOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'}"
				>
					<AlertTriangle class="h-3.5 w-3.5" />
					{filterIssuesOnly ? 'Showing Issues Only' : 'Filter Issues'}
				</button>

				<button
					type="button"
					onclick={handleDeleteAlbum}
					class="rounded-xl p-2 text-neutral-500 hover:bg-rose-950/60 hover:text-rose-400 transition border border-transparent hover:border-rose-900"
					title="Delete entire album"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- Tracklist Section -->
	<section class="mt-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-bold text-neutral-100 flex items-center gap-2">
				<Music class="h-5 w-5 text-purple-400" />
				Tracklist ({displayedTracks.length})
			</h2>

			<span class="text-xs text-neutral-400">
				Tip: Click on badges to quickly toggle status or format
			</span>
		</div>

		{#if displayedTracks.length > 0}
			<div class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/30">
				{#each discGroups as group (group.disc)}
					{#if discGroups.length > 1}
						<div class="border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
							<Disc3 class="h-3.5 w-3.5" />
							Disc {group.disc}
						</div>
					{/if}

					<div class="divide-y divide-neutral-800/40">
						{#each group.tracks as track (track.id)}
							<TrackRow
								{track}
								onTrackUpdated={handleTrackUpdated}
								onTrackDeleted={handleTrackDeleted}
							/>
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-neutral-800 p-8 text-center text-neutral-400">
				{#if filterIssuesOnly}
					<CheckCircle2 class="mx-auto h-8 w-8 text-emerald-400 mb-2" />
					<p class="font-semibold text-neutral-200">No issues found!</p>
					<p class="text-xs text-neutral-500 mt-1">All tracks on this album meet your quality, censorship, and lyrics requirements.</p>
				{:else}
					<p>No tracks in this album yet.</p>
					<button
						type="button"
						onclick={() => (showAddTrackModal = true)}
						class="mt-3 inline-flex items-center gap-1 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white"
					>
						<Plus class="h-4 w-4" /> Add Track
					</button>
				{/if}
			</div>
		{/if}
	</section>
</div>

<!-- Modal: Batch Update Tracks -->
{#if showBatchModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-neutral-800 pb-4">
				<h3 class="text-base font-bold text-white flex items-center gap-2">
					<Layers class="h-5 w-5 text-purple-400" />
					Batch Update All Tracks
				</h3>
				<button type="button" onclick={() => (showBatchModal = false)} class="text-neutral-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>

			<p class="mt-3 text-xs text-neutral-400">
				Apply settings to all {tracks.length} tracks on this album at once. Leave fields unselected to keep their existing values.
			</p>

			<div class="mt-4 space-y-4">
				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Set Audio Format</label>
					<select
						bind:value={batchFormat}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
					>
						<option value="">-- Keep Current Format --</option>
						{#each FORMAT_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Set Audio Quality</label>
					<select
						bind:value={batchQuality}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
					>
						<option value="">-- Keep Current Quality --</option>
						{#each QUALITY_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Set Censorship Status</label>
					<select
						bind:value={batchCensorship}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
					>
						<option value="">-- Keep Current Censorship --</option>
						{#each CENSORSHIP_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Set Lyrics Status</label>
					<select
						bind:value={batchLyrics}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
					>
						<option value="">-- Keep Current Lyrics --</option>
						{#each LYRICS_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
				<button
					type="button"
					onclick={() => (showBatchModal = false)}
					class="rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={submitBatchUpdate}
					disabled={isBatchSubmitting}
					class="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-md shadow-purple-600/30"
				>
					{isBatchSubmitting ? 'Updating...' : 'Apply to All Tracks'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Edit Album Metadata -->
{#if showEditAlbumModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-neutral-800 pb-4">
				<h3 class="text-base font-bold text-white flex items-center gap-2">
					<Pencil class="h-4 w-4 text-purple-400" />
					Edit Album Info
				</h3>
				<button type="button" onclick={() => (showEditAlbumModal = false)} class="text-neutral-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="mt-4 space-y-4">
				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Album Title *</label>
					<input
						type="text"
						bind:value={editTitle}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Artist *</label>
					<input
						type="text"
						bind:value={editArtist}
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Release Year</label>
						<input
							type="number"
							bind:value={editYear}
							placeholder="e.g. 1994"
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
						/>
					</div>

					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Media Type</label>
						<select
							bind:value={editMediaType}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
						>
							<option value="Digital">Digital / Web</option>
							<option value="CD">CD</option>
							<option value="Vinyl">Vinyl</option>
							<option value="Cassette">Cassette</option>
						</select>
					</div>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Genre</label>
					<input
						type="text"
						bind:value={editGenre}
						placeholder="e.g. Electronic, Synthpop, Rock"
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Cover Image URL</label>
					<input
						type="url"
						bind:value={editCoverUrl}
						placeholder="https://..."
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Album Notes</label>
					<textarea
						bind:value={editNotes}
						rows="2"
						placeholder="Notes about release, origin, or rip details..."
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					></textarea>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
				<button
					type="button"
					onclick={() => (showEditAlbumModal = false)}
					class="rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={submitEditAlbum}
					class="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Add Single Track -->
{#if showAddTrackModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-neutral-800 pb-4">
				<h3 class="text-base font-bold text-white flex items-center gap-2">
					<Plus class="h-4 w-4 text-purple-400" />
					Add Track
				</h3>
				<button type="button" onclick={() => (showAddTrackModal = false)} class="text-neutral-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="mt-4 space-y-4">
				<div>
					<label class="block text-xs font-semibold text-neutral-300 mb-1">Track Title *</label>
					<input
						type="text"
						bind:value={newTrackTitle}
						placeholder="Track name"
						class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Track Number</label>
						<input
							type="number"
							bind:value={newTrackNumber}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						/>
					</div>

					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Disc Number</label>
						<input
							type="number"
							bind:value={newTrackDisc}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Track Artist (optional)</label>
						<input
							type="text"
							bind:value={newTrackArtist}
							placeholder="Leave blank if same as album"
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						/>
					</div>

					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Duration (mm:ss)</label>
						<input
							type="text"
							bind:value={newTrackDuration}
							placeholder="3:45"
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Format</label>
						<select
							bind:value={newTrackFormat}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						>
							{#each FORMAT_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Audio Quality</label>
						<select
							bind:value={newTrackQuality}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						>
							{#each QUALITY_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Censorship</label>
						<select
							bind:value={newTrackCensorship}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						>
							{#each CENSORSHIP_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-xs font-semibold text-neutral-300 mb-1">Lyrics</label>
						<select
							bind:value={newTrackLyrics}
							class="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
						>
							{#each LYRICS_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
				<button
					type="button"
					onclick={() => (showAddTrackModal = false)}
					class="rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={submitAddTrack}
					disabled={!newTrackTitle.trim()}
					class="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
				>
					Add Track
				</button>
			</div>
		</div>
	</div>
{/if}
