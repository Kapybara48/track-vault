<script lang="ts">
	import type { PageData } from './$types.js';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import {
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
		ArrowRight
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.searchQuery);

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams(window.location.search);
		if (searchQuery.trim()) {
			params.set('q', searchQuery.trim());
		} else {
			params.delete('q');
		}
		goto(`/?${params.toString()}`);
	}

	function setFilter(filterVal: string) {
		const params = new URLSearchParams(window.location.search);
		if (filterVal === 'all') {
			params.delete('filter');
		} else {
			params.set('filter', filterVal);
		}
		goto(`/?${params.toString()}`);
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	<!-- Top Stats & Health Banner -->
	<section class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Health Score Card -->
		<div class="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Vault Health</span>
				<Sparkles class="h-4 w-4 text-purple-400" />
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
		</div>

		<!-- Audio Formats Card -->
		<div class="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Audio Formats</span>
				<Disc3 class="h-4 w-4 text-blue-400" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight text-white">
					{data.stats.flac_count}
				</span>
				<span class="text-xs text-blue-400 font-medium">FLAC / Lossless</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400">
				{data.stats.mp3_count} MP3 • {data.stats.other_format_count} other
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
			<p class="mt-2 text-xs text-neutral-400 group-hover:text-purple-300 transition flex items-center gap-1">
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
				{data.stats.synced_lyrics_count} Synced .LRC • {data.stats.plain_lyrics_count} Plain
			</p>
		</a>

		<!-- Bad Quality Card -->
		<a
			href="/issues?type=bad_quality"
			class="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg backdrop-blur transition hover:border-neutral-700 hover:bg-neutral-900/80"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bad Quality Rips</span>
				<TriangleAlert class="h-4 w-4 text-red-400 group-hover:scale-110 transition" />
			</div>
			<div class="mt-3 flex items-baseline gap-2">
				<span class="text-3xl font-black tracking-tight {data.stats.bad_quality_count > 0 ? 'text-rose-400' : 'text-emerald-400'}">
					{data.stats.bad_quality_count}
				</span>
				<span class="text-xs text-neutral-400">to upgrade</span>
			</div>
			<p class="mt-2 text-xs text-neutral-400 group-hover:text-purple-300 transition flex items-center gap-1">
				<span>Low bitrate / distorted</span>
				<ArrowRight class="h-3 w-3" />
			</p>
		</a>
	</section>

	<!-- Search & Filters Header -->
	<section class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<!-- Search Input -->
		<form onsubmit={handleSearch} class="relative w-full md:w-80">
			<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search albums, artists..."
				class="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 pl-10 pr-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
			/>
		</form>

		<!-- Filter Pills -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => setFilter('all')}
				class="rounded-lg px-3 py-1.5 text-xs font-semibold transition {data.activeFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				All Albums ({data.stats.total_albums})
			</button>

			<button
				type="button"
				onclick={() => setFilter('needs_attention')}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition {data.activeFilter === 'needs_attention' ? 'bg-amber-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				<TriangleAlert class="h-3.5 w-3.5" />
				Needs Attention
			</button>

			<button
				type="button"
				onclick={() => setFilter('bad_quality')}
				class="rounded-lg px-3 py-1.5 text-xs font-medium transition {data.activeFilter === 'bad_quality' ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Bad Quality
			</button>

			<button
				type="button"
				onclick={() => setFilter('censored')}
				class="rounded-lg px-3 py-1.5 text-xs font-medium transition {data.activeFilter === 'censored' ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Censored
			</button>

			<button
				type="button"
				onclick={() => setFilter('missing_lyrics')}
				class="rounded-lg px-3 py-1.5 text-xs font-medium transition {data.activeFilter === 'missing_lyrics' ? 'bg-amber-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				Missing Lyrics
			</button>

			<button
				type="button"
				onclick={() => setFilter('all_good')}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition {data.activeFilter === 'all_good' ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}"
			>
				<CheckCircle2 class="h-3.5 w-3.5" />
				Vault Ready
			</button>
		</div>
	</section>

	<!-- Albums Grid -->
	{#if data.albums.length > 0}
		<section class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each data.albums as album (album.id)}
				<AlbumCard {album} />
			{/each}
		</section>
	{:else}
		<!-- Empty State -->
		<section class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-20 text-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800/80 text-purple-400 mb-4">
				<Disc3 class="h-8 w-8" />
			</div>
			<h3 class="text-lg font-bold text-neutral-100">
				{#if data.searchQuery || data.activeFilter !== 'all'}
					No albums matching your filter
				{:else}
					Your Track Vault is empty
				{/if}
			</h3>
			<p class="mt-1 max-w-sm text-sm text-neutral-400">
				{#if data.searchQuery || data.activeFilter !== 'all'}
					Try adjusting your search query or reset filters to see all albums.
				{:else}
					Start tracking your collection by searching MusicBrainz or adding an album manually.
				{/if}
			</p>
			<div class="mt-6 flex items-center gap-3">
				{#if data.searchQuery || data.activeFilter !== 'all'}
					<button
						type="button"
						onclick={() => goto('/')}
						class="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
					>
						Clear Filters
					</button>
				{:else}
					<a
						href="/add"
						class="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500"
					>
						<Plus class="h-4 w-4" />
						Add First Album
					</a>
				{/if}
			</div>
		</section>
	{/if}
</div>
