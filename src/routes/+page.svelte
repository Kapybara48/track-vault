<script lang="ts">
	import type { PageData } from './$types.js';
	import type { Track } from '$lib/types/index.js';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import {
		formatDuration,
		FORMAT_OPTIONS,
		QUALITY_OPTIONS,
		CENSORSHIP_OPTIONS,
		LYRICS_OPTIONS,
		getFormatBadgeClass
	} from '$lib/utils.js';
	import {
		Disc,
		Disc3,
		Plus,
		Search,
		TriangleAlert,
		CheckCircle2,
		ShieldAlert,
		FileText,
		Sparkles,
		Flame,
		Layers,
		ArrowRight,
		SlidersHorizontal,
		RotateCcw,
		Music,
		Grid,
		ListMusic,
		Filter
	} from '@lucide/svelte';
	import CustomCheckbox from '$lib/components/CustomCheckbox.svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.searchQuery);
	let selectedFormat = $state(data.activeFormat || 'all');
	let selectedCensorship = $state(data.activeCensorship || 'all');
	let selectedLyrics = $state(data.activeLyrics || 'all');
	let currentView = $state<'albums' | 'tracks'>(data.activeView || 'albums');

	let tracksList = $state<Track[]>([...data.matchingTracks]);

	$effect(() => {
		searchQuery = data.searchQuery;
		selectedFormat = data.activeFormat || 'all';
		selectedCensorship = data.activeCensorship || 'all';
		selectedLyrics = data.activeLyrics || 'all';
		currentView = data.activeView || 'albums';
		tracksList = [...data.matchingTracks];
	});

	function applyFilters(overrides: {
		q?: string;
		filter?: string;
		format?: string;
		censor?: string;
		lyrics?: string;
		view?: 'albums' | 'tracks';
	} = {}) {
		const params = new URLSearchParams(window.location.search);

		const q = overrides.q !== undefined ? overrides.q : searchQuery;
		if (q.trim()) params.set('q', q.trim());
		else params.delete('q');

		const f = overrides.filter !== undefined ? overrides.filter : data.activeFilter;
		if (f && f !== 'all') params.set('filter', f);
		else params.delete('filter');

		const fmt = overrides.format !== undefined ? overrides.format : selectedFormat;
		if (fmt && fmt !== 'all') params.set('format', fmt);
		else params.delete('format');

		const cens = overrides.censor !== undefined ? overrides.censor : selectedCensorship;
		if (cens && cens !== 'all') params.set('censor', cens);
		else params.delete('censor');

		const lyr = overrides.lyrics !== undefined ? overrides.lyrics : selectedLyrics;
		if (lyr && lyr !== 'all') params.set('lyrics', lyr);
		else params.delete('lyrics');

		const v = overrides.view !== undefined ? overrides.view : currentView;
		if (v && v !== 'albums') params.set('view', v);
		else params.delete('view');

		goto(`/?${params.toString()}`);
	}

	function handleSearchSubmit(e: Event) {
		e.preventDefault();
		applyFilters({ q: searchQuery });
	}

	function setFilterPill(filterVal: string) {
		applyFilters({ filter: filterVal });
	}

	function quickSearch(tag: string) {
		searchQuery = tag;
		applyFilters({ q: tag });
	}

	function resetAll() {
		searchQuery = '';
		selectedFormat = 'all';
		selectedCensorship = 'all';
		selectedLyrics = 'all';
		goto('/');
	}

	async function quickFixTrack(trackId: number, patch: Partial<Track>) {
		try {
			const res = await fetch(`/api/tracks/${trackId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (res.ok) {
				const json = await res.json();
				if (json.track) {
					const idx = tracksList.findIndex((t) => t.id === trackId);
					if (idx !== -1) tracksList[idx] = json.track;
				}
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to quick fix track:', err);
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	<!-- Top Stats & Health Banner -->
	<section class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Health Score Card -->
		<div class="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Vault Health</span>
				<Sparkles class="h-4 w-4 text-emerald-400" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight {data.stats.health_score >= 80 ? 'text-emerald-400' : data.stats.health_score >= 50 ? 'text-amber-400' : 'text-rose-400'}">
					{data.stats.health_score}%
				</span>
				<span class="text-xs text-neutral-400">pristine tracks</span>
			</div>
			<div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
				<div
					class="h-full rounded-full transition-all duration-500 {data.stats.health_score >= 80 ? 'bg-emerald-500' : data.stats.health_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}"
					style="width: {data.stats.health_score}%"
				></div>
			</div>
			<div class="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400">
				<span class="flex items-center gap-1 text-emerald-400 font-medium">
					<CheckCircle2 class="h-3 w-3" />
					{data.stats.checked_tracks_count || 0}/{data.stats.total_tracks} verified
				</span>
				<span>{Math.round(((data.stats.checked_tracks_count || 0) / (data.stats.total_tracks || 1)) * 100)}% audited</span>
			</div>
		</div>

		<!-- Audio Formats Card -->
		<div
			class="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur cursor-pointer hover:border-emerald-700/50 transition"
			onclick={() => quickSearch('!flac')}
			title="Click to view all non-FLAC files (!flac)"
			role="button"
			tabindex="0"
			onkeydown={(e) => { if (e.key === 'Enter') quickSearch('!flac'); }}
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Audio Formats</span>
				<Disc3 class="h-4 w-4 text-teal-400" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight text-white">
					{data.stats.flac_count}
				</span>
				<span class="text-xs text-emerald-400 font-medium">FLAC / Lossless</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400">
				<span class="text-amber-400 font-semibold">{data.stats.mp3_count + data.stats.other_format_count} non-FLAC</span> (Click to filter !flac)
			</p>
		</div>

		<!-- Censorship Tracker Card -->
		<a
			href="/issues?type=censored"
			class="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur transition hover:border-neutral-700 hover:bg-neutral-900/80"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Censored Tracks</span>
				<ShieldAlert class="h-4 w-4 text-rose-400 group-hover:scale-110 transition" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight {data.stats.censored_count > 0 ? 'text-rose-400' : 'text-neutral-300'}">
					{data.stats.censored_count}
				</span>
				<span class="text-xs text-neutral-400">radio edits</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400 group-hover:text-emerald-300 transition flex items-center gap-1">
				<span>Need explicit version</span>
				<ArrowRight class="h-3 w-3" />
			</p>
		</a>

		<!-- Lyrics Coverage Card -->
		<a
			href="/issues?type=missing_lyrics"
			class="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur transition hover:border-neutral-700 hover:bg-neutral-900/80"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Lyrics Status</span>
				<FileText class="h-4 w-4 text-emerald-400 group-hover:scale-110 transition" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight {data.stats.missing_lyrics_count > 0 ? 'text-amber-400' : 'text-emerald-400'}">
					{data.stats.missing_lyrics_count}
				</span>
				<span class="text-xs text-neutral-400">missing lyrics</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400">
				{data.stats.synced_lyrics_count} Synced .LRC {#if data.stats.unsynced_lyrics_count > 0}• <span class="text-amber-400">{data.stats.unsynced_lyrics_count} Unsynced</span>{/if}
			</p>
		</a>

		<!-- Bad Quality Card -->
		<a
			href="/issues?type=bad_quality"
			class="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur transition hover:border-neutral-700 hover:bg-neutral-900/80"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bad Quality Rips</span>
				<TriangleAlert class="h-4 w-4 text-rose-400 group-hover:scale-110 transition" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight {data.stats.bad_quality_count > 0 ? 'text-rose-400' : 'text-emerald-400'}">
					{data.stats.bad_quality_count}
				</span>
				<span class="text-xs text-neutral-400">to upgrade</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400 group-hover:text-emerald-300 transition flex items-center gap-1">
				<span>Low bitrate / distorted</span>
				<ArrowRight class="h-3 w-3" />
			</p>
		</a>
	</section>

	<!-- Advanced Search & Filter Section -->
	<section class="mb-6 space-y-3 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5 shadow-lg">
		<!-- Search Form & View Switcher -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
			<!-- Query Input -->
			<form onsubmit={handleSearchSubmit} class="relative flex-1 max-w-2xl">
				<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search albums, artists, or specific filters: !flac, censored, !missing, eminem !flac..."
					class="w-full rounded-2xl border border-neutral-700 bg-neutral-950 pl-10 pr-24 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
					{#if searchQuery}
						<button
							type="button"
							onclick={() => { searchQuery = ''; applyFilters({ q: '' }); }}
							class="rounded-lg p-1 text-neutral-500 hover:text-white"
							title="Clear search"
						>
							<RotateCcw class="h-3.5 w-3.5" />
						</button>
					{/if}
					<button
						type="submit"
						class="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/30 transition"
					>
						Search
					</button>
				</div>
			</form>

			<!-- View Mode Toggle: Albums vs Song Files -->
			<div class="flex items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-950 p-1 self-start sm:self-auto">
				<button
					type="button"
					onclick={() => applyFilters({ view: 'albums' })}
					class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition {currentView === 'albums' ? 'bg-emerald-600 text-white shadow shadow-emerald-600/30' : 'text-neutral-400 hover:text-white'}"
				>
					<Grid class="h-3.5 w-3.5" />
					<span>Albums ({data.albums.length})</span>
				</button>
				<button
					type="button"
					onclick={() => applyFilters({ view: 'tracks' })}
					class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition {currentView === 'tracks' ? 'bg-emerald-600 text-white shadow shadow-emerald-600/30' : 'text-neutral-400 hover:text-white'}"
				>
					<ListMusic class="h-3.5 w-3.5" />
					<span>Song Files ({data.totalMatchingTracks})</span>
				</button>
			</div>
		</div>

		<!-- Direct Dropdowns: Specific Format, Censorship, Lyrics, and Quality -->
		<div class="flex flex-wrap items-center gap-2.5 pt-2 border-t border-neutral-800/60 text-xs">
			<span class="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
				<Filter class="h-3 w-3 text-emerald-400" />
				Filters:
			</span>

			<!-- Specific Format Dropdown (including !FLAC / Non-FLAC) -->
			<select
				value={selectedFormat}
				onchange={(e) => applyFilters({ format: e.currentTarget.value })}
				class="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-200 focus:outline-none focus:border-emerald-500 {selectedFormat !== 'all' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40' : ''}"
			>
				<option value="all">All Formats</option>
				<option value="!FLAC">!FLAC (All Non-FLAC Files)</option>
				<option value="FLAC">FLAC Lossless</option>
				<option value="MP3">MP3 (All Bitrates)</option>
				<option value="MP3_320">MP3 320kbps</option>
				<option value="MP3_V0">MP3 V0</option>
				<option value="MP3_128">MP3 128kbps</option>
				<option value="AAC_256">AAC / M4A</option>
				<option value="WAV">WAV</option>
				<option value="ALAC">ALAC</option>
				<option value="OGG">OGG</option>
			</select>

			<!-- Specific Censorship Dropdown -->
			<select
				value={selectedCensorship}
				onchange={(e) => applyFilters({ censor: e.currentTarget.value })}
				class="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-200 focus:outline-none focus:border-emerald-500 {selectedCensorship !== 'all' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40' : ''}"
			>
				<option value="all">All Censorship</option>
				<option value="censored">Censored Only (Radio Edits)</option>
				<option value="explicit">Explicit Only</option>
				<option value="clean_original">Clean Original</option>
				<option value="!censored">!Censored (Not Censored)</option>
			</select>

			<!-- Specific Lyrics Dropdown -->
			<select
				value={selectedLyrics}
				onchange={(e) => applyFilters({ lyrics: e.currentTarget.value })}
				class="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-200 focus:outline-none focus:border-emerald-500 {selectedLyrics !== 'all' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40' : ''}"
			>
				<option value="all">All Lyrics Status</option>
				<option value="missing">Missing Lyrics</option>
				<option value="unsynced_lrc">Unsynced LRC</option>
				<option value="synced_lrc">Synced LRC</option>
				<option value="plain_txt">Plain TXT</option>
				<option value="!missing">!Missing (Has Any Lyrics)</option>
			</select>

			<!-- Quick Syntax Chips -->
			<div class="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-400 ml-auto">
				<span class="text-neutral-500">Quick syntax:</span>
				<button
					type="button"
					onclick={() => quickSearch('!flac')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 hover:text-white"
					title="Filter all non-flac files"
				>
					!flac
				</button>
				<button
					type="button"
					onclick={() => quickSearch('censored')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-rose-300 hover:text-white"
				>
					censored
				</button>
				<button
					type="button"
					onclick={() => quickSearch('!missing')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-sky-300 hover:text-white"
				>
					!missing
				</button>
				<button
					type="button"
					onclick={() => quickSearch('synced')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-teal-300 hover:text-white"
				>
					synced
				</button>
				<button
					type="button"
					onclick={() => quickSearch('!checked')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 hover:text-white"
					title="Show songs not yet manually checked"
				>
					!checked
				</button>
				<button
					type="button"
					onclick={() => quickSearch('checked')}
					class="rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 hover:text-white"
					title="Show songs manually checked & verified"
				>
					checked
				</button>
				{#if data.searchQuery || data.activeFilter !== 'all' || selectedFormat !== 'all' || selectedCensorship !== 'all' || selectedLyrics !== 'all'}
					<button
						type="button"
						onclick={resetAll}
						class="text-neutral-400 hover:text-rose-400 ml-1 text-[11px] underline"
					>
						Reset
					</button>
				{/if}
			</div>
		</div>

		<!-- Status Category Pills -->
		<div class="flex flex-wrap items-center gap-1.5 pt-1">
			<button
				type="button"
				onclick={() => setFilterPill('all')}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {data.activeFilter === 'all' ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				All Albums
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('needs_attention')}
				class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition {data.activeFilter === 'needs_attention' ? 'bg-amber-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				<TriangleAlert class="h-3 w-3" />
				Needs Attention
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('unverified')}
				class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'unverified' ? 'bg-amber-700 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
				title="Albums with unverified tracks"
			>
				<span>Unverified</span>
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('verified')}
				class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition {data.activeFilter === 'verified' ? 'bg-emerald-700 text-white shadow-sm' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
				title="Albums where all tracks are manually verified"
			>
				<CheckCircle2 class="h-3 w-3 text-emerald-300" />
				<span>100% Verified</span>
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('bad_quality')}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'bad_quality' ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Bad Quality
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('censored')}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'censored' ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Censored
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('missing_lyrics')}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'missing_lyrics' ? 'bg-amber-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Missing Lyrics
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('unsynced_lyrics')}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'unsynced_lyrics' ? 'bg-amber-700 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Unsynced LRC
			</button>

			<button
				type="button"
				onclick={() => setFilterPill('all_good')}
				class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition {data.activeFilter === 'all_good' ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				<CheckCircle2 class="h-3 w-3" />
				Vault Ready
			</button>
		</div>
	</section>

	<!-- VIEW 1: ALBUMS GRID -->
	{#if currentView === 'albums'}
		{#if data.albums.length > 0}
			<section class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each data.albums as album (album.id)}
					<AlbumCard {album} />
				{/each}
			</section>
		{:else}
			<!-- Empty State -->
			<section class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-20 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800/80 text-emerald-400 mb-4">
					<Disc3 class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-bold text-neutral-100">
					{#if data.searchQuery || data.activeFilter !== 'all' || selectedFormat !== 'all' || selectedCensorship !== 'all' || selectedLyrics !== 'all'}
						No albums matching your criteria
					{:else}
						Your Track Vault is empty
					{/if}
				</h3>
				<p class="mt-1 max-w-sm text-sm text-neutral-400">
					{#if data.searchQuery || data.activeFilter !== 'all' || selectedFormat !== 'all' || selectedCensorship !== 'all' || selectedLyrics !== 'all'}
						Try adjusting search terms (e.g. !flac, censored) or clear the filter.
					{:else}
						Start tracking your collection by scanning your music library or adding albums.
					{/if}
				</p>
				<div class="mt-6 flex items-center gap-3">
					{#if data.searchQuery || data.activeFilter !== 'all' || selectedFormat !== 'all' || selectedCensorship !== 'all' || selectedLyrics !== 'all'}
						<button
							type="button"
							onclick={resetAll}
							class="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
						>
							Reset Filters
						</button>
					{:else}
						<a
							href="/scan"
							class="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
						>
							<Plus class="h-4 w-4" />
							Scan Music Files
						</a>
					{/if}
				</div>
			</section>
		{/if}

	<!-- VIEW 2: SONG FILES VIEW (Show all files matching !flac, etc.) -->
	{:else}
		{#if tracksList.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between text-xs text-neutral-400 px-1">
					<span>
						Showing <strong class="text-white font-bold">{tracksList.length}</strong> matching song {tracksList.length === 1 ? 'file' : 'files'}
					</span>
					<span class="text-neutral-500">
						1-click quick update or jump into the album
					</span>
				</div>

				<div class="rounded-2xl border border-neutral-800 bg-neutral-900/40 divide-y divide-neutral-800/80 overflow-hidden">
					{#each tracksList as track (track.id)}
						<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 transition hover:bg-neutral-900/80 {track.needs_attention ? 'border-l-4 border-l-amber-500/80 bg-amber-500/[0.02]' : track.manually_checked === 1 ? 'border-l-4 border-l-emerald-500/60 bg-emerald-500/[0.02]' : ''}">
							<!-- Track info with thumbnail -->
							<div class="flex items-center gap-3 min-w-0 flex-1">
								<!-- Manual Checkbox -->
								<div
									class="flex items-center shrink-0"
									title={track.manually_checked === 1 ? 'Marked as manually checked & verified (Click to uncheck)' : 'Click to mark as manually checked (100% verified)'}
								>
									<CustomCheckbox
										checked={track.manually_checked === 1}
										onchange={(checked) => quickFixTrack(track.id, { manually_checked: checked ? 1 : 0 })}
									/>
								</div>

								<a
									href="/album/{track.album_id}"
									class="relative aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 transition"
									title="View album: {track.album_title}"
								>
									{#if track.album_cover_url}
										<img
											src={track.album_cover_url}
											alt={track.album_title}
											class="h-full w-full object-cover"
											onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
										/>
									{:else}
										<div class="flex h-full w-full items-center justify-center text-neutral-600">
											<Disc class="h-6 w-6 opacity-40" />
										</div>
									{/if}
								</a>

								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-bold text-sm {track.manually_checked === 1 ? 'text-emerald-100' : 'text-neutral-100'}" title={track.title}>
											{track.title}
										</span>
										{#if track.manually_checked === 1}
											<span
												class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30"
												title="Manually checked and verified"
											>
												<CheckCircle2 class="h-3 w-3" />
												Checked
											</span>
										{/if}
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
											class="truncate hover:text-emerald-300 transition text-neutral-400"
											title="Open album"
										>
											{track.album_title}
										</a>
										{#if track.duration_ms}
											<span>•</span>
											<span class="font-mono text-neutral-500">{formatDuration(track.duration_ms)}</span>
										{/if}
									</div>
								</div>
							</div>

							<!-- Badges & Controls -->
							<div class="flex flex-wrap items-center gap-2 lg:justify-end">
								<!-- Format Badge -->
								<span class="rounded-lg border px-2.5 py-0.5 text-xs font-semibold uppercase {getFormatBadgeClass(track.format)}">
									{track.format}
								</span>

								<!-- Quality Badge -->
								<span class="rounded-lg border px-2 py-0.5 text-xs font-medium {QUALITY_OPTIONS.find(q => q.value === track.quality_rating)?.color}">
									{track.quality_rating}
								</span>

								<!-- Censorship Badge -->
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

								<!-- Lyrics Badge -->
								<span class="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium {LYRICS_OPTIONS.find(l => l.value === track.lyrics)?.color}">
									{#if track.lyrics === 'synced_lrc'}
										<CheckCircle2 class="h-3 w-3 text-emerald-400" />
										<span>Synced LRC</span>
									{:else if track.lyrics === 'unsynced_lrc'}
										<FileText class="h-3 w-3 text-amber-300" />
										<span>Unsynced LRC</span>
									{:else if track.lyrics === 'plain_txt'}
										<FileText class="h-3 w-3 text-sky-400" />
										<span>Plain TXT</span>
									{:else}
										<TriangleAlert class="h-3 w-3 text-rose-400" />
										<span>No Lyrics</span>
									{/if}
								</span>

								<!-- 1-Click Upgrade / Actions -->
								<div class="flex items-center gap-1.5 border-l border-neutral-800 pl-2 ml-1">
									{#if track.format !== 'FLAC'}
										<button
											type="button"
											onclick={() => quickFixTrack(track.id, { format: 'FLAC', quality_rating: 'good' })}
											class="rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-700/80 px-2 py-0.5 text-xs font-semibold text-teal-300 transition"
											title="Upgrade to FLAC lossless"
										>
											+ FLAC
										</button>
									{/if}

									<a
										href="/album/{track.album_id}"
										class="rounded-lg bg-neutral-800 p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700"
										title="Open Album"
									>
										<ArrowRight class="h-3.5 w-3.5" />
									</a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{:else}
			<section class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-20 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800/80 text-emerald-400 mb-4">
					<ListMusic class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-bold text-neutral-100">
					No song files matching your criteria
				</h3>
				<p class="mt-1 max-w-sm text-sm text-neutral-400">
					Try clearing the search or filters to see all songs.
				</p>
				<button
					type="button"
					onclick={resetAll}
					class="mt-6 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
				>
					Reset Filters
				</button>
			</section>
		{/if}
	{/if}
</div>
