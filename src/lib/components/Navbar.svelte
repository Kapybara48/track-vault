<script lang="ts">
	import { page } from '$app/state';
	import {
		Disc3,
		TriangleAlert,
		Plus,
		Music,
		Library,
		Sparkles,
		FolderSync,
		LogOut,
		User as UserIcon,
		Settings as SettingsIcon
	} from '@lucide/svelte';

	interface Props {
		issuesCount?: number;
		user?: { id: number; username: string; role: string } | null;
		authDisabled?: boolean;
	}

	let { issuesCount = 0, user = null, authDisabled = false }: Props = $props();

	const currentPath = $derived(page.url.pathname);

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (e) {
			console.error('Logout error:', e);
		}
		window.location.href = '/login';
	}
</script>

<header class="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md">
	<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
		<!-- Brand Logo -->
		<div class="flex items-center gap-6">
			<a href="/" class="flex items-center gap-2.5 transition hover:opacity-90">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-emerald-500/20 border border-emerald-500/30 bg-neutral-900">
					<img src="/favicon.svg" alt="Track Vault Icon" class="h-full w-full object-cover" />
				</div>
				<div>
					<span class="text-lg font-black tracking-wider text-white">TRACK<span class="text-emerald-400">VAULT</span></span>
					<span class="block text-[10px] font-medium uppercase tracking-widest text-emerald-400/80">Music Quality & Lyrics Tracker</span>
				</div>
			</a>

			<!-- Navigation Links -->
			<nav class="hidden md:flex items-center gap-1.5 ml-4">
				<a
					href="/"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath === '/' ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<Library class="h-4 w-4" />
					Vault Albums
				</a>

				<a
					href="/issues"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath.startsWith('/issues') ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
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
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath.startsWith('/scan') ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<FolderSync class="h-4 w-4 text-emerald-400" />
					Scan Library
				</a>

				<a
					href="/settings"
					class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition {currentPath.startsWith('/settings') ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-sm' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
				>
					<SettingsIcon class="h-4 w-4 text-emerald-400" />
					Settings
				</a>
			</nav>
		</div>

		<!-- Action Buttons & User Menu -->
		<div class="flex items-center gap-2 sm:gap-3">
			<a
				href="/add"
				class="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
			>
				<Plus class="h-4 w-4" />
				<span>Add Album</span>
			</a>

			{#if user && !authDisabled}
				<div class="flex items-center gap-2 pl-2 border-l border-neutral-800">
					<a
						href="/settings"
						class="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 hover:border-emerald-600/50 hover:text-white transition"
						title="Account Settings ({user.username})"
					>
						<UserIcon class="h-3.5 w-3.5 text-emerald-400" />
						<span class="truncate max-w-[100px]">{user.username}</span>
					</a>

					<button
						type="button"
						onclick={handleLogout}
						class="rounded-xl p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition cursor-pointer"
						title="Sign Out"
					>
						<LogOut class="h-4 w-4" />
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mobile Navigation Bar -->
	<div class="flex md:hidden border-t border-neutral-800/80 px-4 py-2 justify-around bg-neutral-950">
		<a
			href="/"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath === '/' ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}"
		>
			<Library class="h-4 w-4" />
			Vault
		</a>
		<a
			href="/scan"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath.startsWith('/scan') ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}"
		>
			<FolderSync class="h-4 w-4" />
			Scan
		</a>
		<a
			href="/issues"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath.startsWith('/issues') ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}"
		>
			<TriangleAlert class="h-4 w-4 {issuesCount > 0 ? 'text-amber-400' : ''}" />
			Fixer
			{#if issuesCount > 0}
				<span class="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300 border border-amber-500/40">
					{issuesCount}
				</span>
			{/if}
		</a>
		<a
			href="/settings"
			class="flex items-center gap-1.5 py-1 text-xs font-medium {currentPath.startsWith('/settings') ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}"
		>
			<SettingsIcon class="h-4 w-4" />
			Settings
		</a>
	</div>
</header>
