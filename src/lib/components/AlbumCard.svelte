<script lang="ts">
	import type { Album } from '$lib/types/index.js';
	import { Disc, AlertTriangle, CheckCircle2, Music } from '@lucide/svelte';

	interface Props {
		album: Album;
	}

	let { album }: Props = $props();

	const hasIssues = $derived(
		(album.bad_quality_count || 0) > 0 ||
		(album.censored_count || 0) > 0 ||
		(album.missing_lyrics_count || 0) > 0
	);
</script>

<a
	href="/album/{album.id}"
	class="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition duration-200 hover:-translate-y-1 hover:border-emerald-700/50 hover:bg-neutral-900/80 hover:shadow-xl hover:shadow-emerald-950/20"
>
	<!-- Cover Art / Thumbnail -->
	<div class="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-950 shadow-inner">
		{#if album.cover_url}
			<img
				src={album.cover_url}
				alt={album.title}
				loading="lazy"
				class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
				onerror={(e) => {
					// Fallback if image fails to load
					(e.currentTarget as HTMLElement).style.display = 'none';
				}}
			/>
		{:else}
			<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-600">
				<Disc class="h-16 w-16 opacity-40 group-hover:rotate-12 transition duration-300" />
			</div>
		{/if}

		<!-- Health Badge on Top Right -->
		<div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
			{#if !hasIssues && (album.track_count || 0) > 0}
				<span class="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-700/60 backdrop-blur-md shadow-sm">
					<CheckCircle2 class="h-3 w-3" />
					Vault Ready
				</span>
			{:else if hasIssues}
				<span class="inline-flex items-center gap-1 rounded-full bg-amber-950/90 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-600/60 backdrop-blur-md shadow-sm">
					<AlertTriangle class="h-3 w-3" />
					Needs Attention
				</span>
			{/if}
		</div>

		{#if album.media_type}
			<div class="absolute bottom-2 left-2">
				<span class="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300 backdrop-blur-sm">
					{album.media_type}
				</span>
			</div>
		{/if}
	</div>

	<!-- Info Section -->
	<div class="mt-3.5 flex flex-1 flex-col justify-between">
		<div>
			<h3 class="truncate font-bold text-neutral-100 group-hover:text-emerald-300 transition" title={album.title}>
				{album.title}
			</h3>
			<p class="truncate text-sm font-medium text-neutral-400" title={album.artist}>
				{album.artist}
			</p>
		</div>

		<div class="mt-3 flex items-center justify-between border-t border-neutral-800/60 pt-2.5 text-xs text-neutral-500">
			<span>{album.release_year || 'Unknown Year'}</span>
			<span>{album.track_count || 0} tracks</span>
		</div>

		<!-- Status Pills Breakdown -->
		{#if hasIssues}
			<div class="mt-2 flex flex-wrap gap-1.5 pt-1">
				{#if (album.bad_quality_count || 0) > 0}
					<span class="rounded bg-rose-950/70 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-800/50">
						{album.bad_quality_count} bad quality
					</span>
				{/if}
				{#if (album.censored_count || 0) > 0}
					<span class="rounded bg-rose-950/70 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-800/50">
						{album.censored_count} censored
					</span>
				{/if}
				{#if (album.missing_lyrics_count || 0) > 0}
					<span class="rounded bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-800/50">
						{album.missing_lyrics_count} no lyrics
					</span>
				{/if}
			</div>
		{/if}
	</div>
</a>
