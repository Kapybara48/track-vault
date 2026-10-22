<script lang="ts">
	import type { PageData } from './$types.js';
	import type { Track, AudioFormat, LyricsStatus, CensorshipStatus, QualityRating } from '$lib/types/index.js';
	import {
		formatDuration,
		FORMAT_OPTIONS,
		QUALITY_OPTIONS,
		CENSORSHIP_OPTIONS,
		LYRICS_OPTIONS,
		getFormatBadgeClass
	} from '$lib/utils.js';
	import {
		TriangleAlert,
		ShieldAlert,
		FileText,
		Disc3,
		CheckCircle2,
		Search,
		Sparkles,
		Disc,
		ExternalLink,
		ArrowRight
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let tracks = $state<Track[]>([...data.tracks]);
	let searchQuery = $state(data.searchQuery);

	$effect(() => {
		tracks = [...data.tracks];
	});

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams(window.location.search);
		if (searchQuery.trim()) {
			params.set('q', searchQuery.trim());
		} else {
			params.delete('q');
		}
		goto(`/issues?${params.toString()}`);
	}

	function setIssueType(type: string) {
		const params = new URLSearchParams(window.location.search);
		params.set('type', type);
		goto(`/issues?${params.toString()}`);
	}

	async function quickFix(trackId: number, patch: Partial<Track>) {
		try {
			const res = await fetch(`/api/tracks/${trackId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});

			if (res.ok) {
				const resData = await res.json();
				const updated: Track = resData.track;
				const idx = tracks.findIndex(t => t.id === trackId);
				if (idx !== -1) {
					// If filtering by specific issue and it's resolved, remove or update
					tracks[idx] = updated;
				}
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to quick-fix track:', err);
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	<!-- Page Header -->
	<div class="mb-6">
		<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400">
			<TriangleAlert class="h-4 w-4 text-amber-400" />
			Track Vault Fixer
		</div>
		<h1 class="mt-1 text-2xl sm:text-3xl font-black text-white">
			Collection Upgrade & Issues Tracker
		</h1>
		<p class="mt-1 text-sm text-neutral-400 max-w-2xl">
			Quickly resolve songs with bad audio quality, replaced censored radio edits with original uncensored releases, and fill in missing synchronized (.lrc) or plain lyrics.
		</p>
	</div>

	<!-- Issue Type Tabs -->
	<div class="mb-6 flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-4">
		<button
			type="button"
			onclick={() => setIssueType('all_issues')}
			class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {data.activeType === 'all_issues' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
		>
			<TriangleAlert class="h-4 w-4" />
			All Issues ({data.stats.total_needs_attention})
		</button>

		<button
			type="button"
			onclick={() => setIssueType('bad_quality')}
			class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {data.activeType === 'bad_quality' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
		>
			<Disc3 class="h-4 w-4" />
			Bad Quality / Low Bitrate ({data.stats.bad_quality_count})
		</button>

		<button
			type="button"
			onclick={() => setIssueType('censored')}
			class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {data.activeType === 'censored' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
		>
			<ShieldAlert class="h-4 w-4" />
			Censored / Radio Edits ({data.stats.censored_count})
		</button>

		<button
			type="button"
			onclick={() => setIssueType('missing_lyrics')}
			class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {data.activeType === 'missing_lyrics' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
		>
			<FileText class="h-4 w-4" />
			Missing Lyrics ({data.stats.missing_lyrics_count})
		</button>
	</div>

	<!-- Search & Controls -->
	<div class="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
		<form onsubmit={handleSearch} class="relative w-full sm:w-80">
			<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search track, artist, album..."
				class="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 pl-10 pr-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
			/>
		</form>

		<span class="text-xs text-neutral-500">
			Showing {tracks.length} matching track{tracks.length === 1 ? '' : 's'}
		</span>
	</div>

	<!-- Track Issues Table -->
	{#if tracks.length > 0}
		<div class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/30">
			<div class="divide-y divide-neutral-800/60">
				{#each tracks as track (track.id)}
					<div class="group flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 transition hover:bg-neutral-900/50">
						<!-- Track & Album Info -->
						<div class="flex items-center gap-4 min-w-0 flex-1">
							<!-- Album Cover Thumbnail -->
							<a href="/album/{track.album_id}" class="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-950 border border-neutral-800">
								{#if track.album_cover_url}
									<img
										src={track.album_cover_url}
										alt={track.album_title || ''}
										class="h-full w-full object-cover"
										onerror={(e) => {
											(e.currentTarget as HTMLElement).style.display = 'none';
										}}
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center text-neutral-600">
										<Disc class="h-6 w-6 opacity-40" />
									</div>
								{/if}
							</a>

							<!-- Titles -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate font-bold text-neutral-100 text-sm" title={track.title}>
										{track.title}
									</span>
									<span class="text-xs text-neutral-500 font-mono">
										#{track.track_number}
									</span>
								</div>

								<div class="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
									<span class="truncate text-neutral-300">
										{track.artist || track.album_artist || 'Unknown Artist'}
									</span>
									<span>•</span>
									<a
										href="/album/{track.album_id}"
										class="truncate hover:text-purple-300 transition"
										title="Open album"
									>
										{track.album_title}
									</a>
									{#if track.duration_ms}
										<span>•</span>
										<span class="font-mono text-neutral-500">{formatDuration(track.duration_ms)}</span>
									{/if}
								</div>

								{#if track.notes}
									<p class="mt-1 text-[11px] italic text-neutral-500">
										"{track.notes}"
									</p>
								{/if}
							</div>
						</div>

						<!-- Issue Badges & Quick Action Controls -->
						<div class="flex flex-wrap items-center gap-2 lg:justify-end">
							<!-- Current Format & Quality -->
							<div class="flex items-center gap-1.5">
								<span class="rounded-lg border px-2 py-0.5 text-xs font-semibold uppercase {getFormatBadgeClass(track.format)}">
									{track.format}
								</span>

								<span class="rounded-lg border px-2 py-0.5 text-xs font-medium {QUALITY_OPTIONS.find(q => q.value === track.quality_rating)?.color}">
									{track.quality_rating}
								</span>
							</div>

							<!-- Current Censorship -->
							<span class="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium {CENSORSHIP_OPTIONS.find(c => c.value === track.censorship)?.color}">
								{#if track.censorship === 'censored'}
									<ShieldAlert class="h-3 w-3 text-rose-400" />
									<span>Censored</span>
								{:else if track.censorship === 'explicit'}
									<span class="font-bold text-amber-300">E</span>
									<span>Explicit</span>
								{:else}
									<span>Clean</span>
								{/if}
							</span>

							<!-- Current Lyrics -->
							<span class="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium {LYRICS_OPTIONS.find(l => l.value === track.lyrics)?.color}">
								{#if track.lyrics === 'synced_lrc'}
									<CheckCircle2 class="h-3 w-3 text-emerald-400" />
									<span>Synced LRC</span>
								{:else if track.lyrics === 'plain_txt'}
									<FileText class="h-3 w-3 text-sky-400" />
									<span>Plain TXT</span>
								{:else}
									<TriangleAlert class="h-3 w-3 text-rose-400" />
									<span>No Lyrics</span>
								{/if}
							</span>

							<!-- Quick 1-Click Fix Buttons -->
							<div class="ml-2 flex items-center gap-1.5 border-l border-neutral-800 pl-3">
								{#if track.quality_rating === 'bad' || track.quality_rating === 'needs_upgrade' || track.format !== 'FLAC'}
									<button
										type="button"
										onclick={() => quickFix(track.id, { format: 'FLAC', quality_rating: 'good' })}
										class="rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 px-2.5 py-1 text-xs font-semibold text-blue-300 transition active:scale-95"
										title="Mark as upgraded to FLAC lossless"
									>
										+ FLAC
									</button>
								{/if}

								{#if track.censorship === 'censored'}
									<button
										type="button"
										onclick={() => quickFix(track.id, { censorship: 'explicit' })}
										class="rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 px-2.5 py-1 text-xs font-semibold text-amber-300 transition active:scale-95"
										title="Mark as replaced with original explicit uncensored track"
									>
										+ Uncensored
									</button>
								{/if}

								{#if track.lyrics === 'missing'}
									<button
										type="button"
										onclick={() => quickFix(track.id, { lyrics: 'synced_lrc' })}
										class="rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition active:scale-95"
										title="Mark as added synced .LRC lyrics"
									>
										+ Synced LRC
									</button>
									<button
										type="button"
										onclick={() => quickFix(track.id, { lyrics: 'plain_txt' })}
										class="rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-700/80 px-2 py-1 text-xs font-semibold text-sky-300 transition active:scale-95"
										title="Mark as plain text lyrics"
									>
										+ Plain
									</button>
								{/if}

								<a
									href="/album/{track.album_id}"
									class="rounded-lg bg-neutral-800 p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700"
									title="View in Album"
								>
									<ArrowRight class="h-3.5 w-3.5" />
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-800 py-16 text-center">
			<CheckCircle2 class="h-12 w-12 text-emerald-400 mb-3" />
			<h3 class="text-lg font-bold text-white">All Clear in this Category!</h3>
			<p class="mt-1 text-xs text-neutral-400 max-w-sm">
				No tracks currently match this issue filter. Your Track Vault is looking pristine!
			</p>
			<a
				href="/"
				class="mt-4 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
			>
				Return to Vault
			</a>
		</div>
	{/if}
</div>
