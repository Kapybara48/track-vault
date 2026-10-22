<script lang="ts">
	import { page } from '$app/state';
	import { Disc3, TriangleAlert, Plus, Music, Library, Sparkles, FolderSync } from '@lucide/svelte';

	interface Props {
		issuesCount?: number;
	}

	let { issuesCount = 0 }: Props = $props();

	const currentPath = $derived(page.url.pathname);
</script>

<header class="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md">
	<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
		<!-- Brand Logo -->
		<div class="flex items-center gap-6">
			<a href="/" class="flex items-center gap-2.5 transition hover:opacity-90">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
					<Disc3 class="h-5 w-5 text-white animate-spin-slow" />
				</div>
				<div>
					<span class="text-lg font-black tracking-wider text-white">TRACK<span class="text-purple-400">VAULT</span></span>
					<span class="block text-[10px] font-medium uppercase tracking-widest text-neutral-400">Music Quality & Lyrics Tracker</span>
				</div>
			</a>

			<!-- Navigation Links -->
			<nav class="hidden md:flex items-center gap-1.5 ml-4">
				<a
					href="/"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath === '/' ? 'bg-neutral-800/90 text-white shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<Library class="h-4 w-4" />
					Vault Albums
				</a>

				<a
					href="/issues"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath.startsWith('/issues') ? 'bg-neutral-800/90 text-white shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<TriangleAlert class="h-4 w-4 {issuesCount > 0 ? 'text-amber-400' : 'text-neutral-400'}" />
					Track Fixer
					{#if issuesCount > 0}
						<span class="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/40">
							{issuesCount}
						</span>
					{/if}
				</a>

				<a
					href="/scan"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath.startsWith('/scan') ? 'bg-neutral-800/90 text-white shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<FolderSync class="h-4 w-4 text-purple-400" />
					Scan Library
				</a>
			</nav>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-3">
			<a
				href="/add"
				class="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-600/25 transition hover:bg-purple-500 active:scale-95"
			>
				<Plus class="h-4 w-4" />
				<span>Add Album</span>
			</a>
		</div>
	</div>

	<!-- Mobile Navigation Bar -->
	<div class="flex md:hidden border-t border-neutral-800/80 px-4 py-2 justify-around bg-neutral-950">
		<a
			href="/"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath === '/' ? 'text-purple-400 font-semibold' : 'text-neutral-400'}"
		>
			<Library class="h-4 w-4" />
			Vault
		</a>
		<a
			href="/scan"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath.startsWith('/scan') ? 'text-purple-400 font-semibold' : 'text-neutral-400'}"
		>
			<FolderSync class="h-4 w-4" />
			Scan
		</a>
		<a
			href="/issues"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath.startsWith('/issues') ? 'text-purple-400 font-semibold' : 'text-neutral-400'}"
		>
			<TriangleAlert class="h-4 w-4 {issuesCount > 0 ? 'text-amber-400' : ''}" />
			Fixer
			{#if issuesCount > 0}
				<span class="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300 border border-amber-500/40">
					{issuesCount}
				</span>
			{/if}
		</a>
	</div>
</header>
