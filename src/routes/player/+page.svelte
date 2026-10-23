<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types.js';
	import type { Track } from '$lib/types/index.js';
	import type { PlayerAlbum } from './+page.server.js';
	import {
		Play,
		Pause,
		SkipBack,
		SkipForward,
		Shuffle,
		Repeat,
		Repeat1,
		Volume2,
		Volume1,
		VolumeX,
		Mic,
		ListMusic,
		Search,
		Disc3,
		Clock,
		ExternalLink,
		X,
		Sparkles,
		Check,
		Music,
		Heart,
		CircleCheck,
		TriangleAlert,
		Library
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// Player State
	let audioEl: HTMLAudioElement | null = $state(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(0.8);
	let isMuted = $state(false);
	let shuffleEnabled = $state(false);
	let repeatMode = $state<'off' | 'all' | 'one'>('all');

	// Active Selection & Queue State
	let selectedAlbum = $state<PlayerAlbum>(data.albums[0] || null);
	let currentTrack = $state<Track | null>(null);
	let currentAlbum = $state<PlayerAlbum | null>(null);
	let activeQueue = $state<Track[]>([]);
	let queueIndex = $state<number>(-1);
	let historyTrackIds = $state<number[]>([]);

	// Filters & Search
	let librarySearch = $state('');
	let libraryFilter = $state<'all' | 'albums' | 'artists' | 'verified' | 'lossless'>('all');
	let albumTrackSearch = $state('');

	// Side Panels State
	let showLyricsDrawer = $state(false);
	let showQueueDrawer = $state(false);

	// Synced Lyrics State
	let lyricsLoading = $state(false);
	let lyricsLines = $state<{ time: number | null; text: string }[]>([]);
	let isInstrumentalLyrics = $state(false);
	let instrumentalMarker = $state('♪');
	let lyricsContainerEl: HTMLDivElement | null = $state(null);

	// Helpers: Format mm:ss
	function formatTime(seconds: number): string {
		if (isNaN(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatDurationMs(ms: number | null | undefined): string {
		if (!ms || isNaN(ms)) return '0:00';
		return formatTime(ms / 1000);
	}

	function formatTotalAlbumDuration(tracks: Track[]): string {
		const totalMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
		const totalSec = Math.floor(totalMs / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h > 0) {
			return `${h} hr ${m} min`;
		}
		return `${m} min ${s} sec`;
	}

	// Parse LRC format into structured lines
	function parseLrc(content: string): { time: number | null; text: string }[] {
		const lines = content.split('\n');
		const result: { time: number | null; text: string }[] = [];

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;
			if (/^\[(ti|ar|al|length|by|offset|re|ve):/i.test(line)) continue;

			const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
			if (match) {
				const m = parseInt(match[1], 10);
				const s = parseInt(match[2], 10);
				const ms = parseFloat(`0.${match[3] || '0'}`);
				result.push({
					time: m * 60 + s + ms,
					text: match[4].trim()
				});
			} else {
				result.push({
					time: null,
					text: line
				});
			}
		}
		return result;
	}

	// Active singing line derived from audio currentTime
	let activeLyricLineIndex = $derived.by(() => {
		if (!lyricsLines.length) return -1;
		let idx = -1;
		for (let i = 0; i < lyricsLines.length; i++) {
			const l = lyricsLines[i];
			if (l.time !== null && l.time <= currentTime) {
				idx = i;
			}
		}
		return idx;
	});

	// Auto-scroll lyrics smoothly to active line
	$effect(() => {
		if (showLyricsDrawer && activeLyricLineIndex >= 0 && lyricsContainerEl) {
			const el = document.getElementById(`lyrics-line-${activeLyricLineIndex}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	});

	// Fetch Lyrics for current track
	async function loadLyricsForCurrentTrack() {
		if (!currentTrack) {
			lyricsLines = [];
			isInstrumentalLyrics = false;
			return;
		}

		lyricsLoading = true;
		try {
			const res = await fetch(`/api/tracks/${currentTrack.id}/lyrics`);
			const json = await res.json();
			if (json.success && json.lyrics_text) {
				const raw = json.lyrics_text.trim();
				if (
					json.status === 'instrumental' ||
					/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*(♪|♫|\[instrumental\]|\(instrumental\)|instrumental)/i.test(raw) ||
					/\[au:\s*instrumental\]/i.test(raw)
				) {
					isInstrumentalLyrics = true;
					instrumentalMarker = raw.includes('[instrumental]') ? '[instrumental]' : '♪';
					lyricsLines = [{ time: 0, text: instrumentalMarker }];
				} else {
					isInstrumentalLyrics = false;
					lyricsLines = parseLrc(raw);
				}
			} else {
				lyricsLines = [];
				isInstrumentalLyrics = false;
			}
		} catch (e) {
			console.error('Error fetching lyrics:', e);
			lyricsLines = [];
			isInstrumentalLyrics = false;
		} finally {
			lyricsLoading = false;
		}
	}

	// Playback Action: Play a specific track
	function playTrack(track: Track, album?: PlayerAlbum, queue?: Track[]) {
		currentTrack = track;
		currentAlbum = album || data.albums.find((a) => a.id === track.album_id) || selectedAlbum;
		activeQueue = queue || (currentAlbum ? currentAlbum.tracks : [track]);
		queueIndex = activeQueue.findIndex((t) => t.id === track.id);
		if (queueIndex === -1 && activeQueue.length > 0) {
			queueIndex = 0;
		}

		if (historyTrackIds.length > 50) historyTrackIds.shift();
		historyTrackIds.push(track.id);

		if (!audioEl) return;
		audioEl.src = `/api/tracks/${track.id}/audio`;
		audioEl.play().catch((err) => {
			console.warn('Playback error:', err);
		});
		isPlaying = true;

		// Update document title
		const artist = track.artist || (currentAlbum ? currentAlbum.artist : 'Track Vault');
		document.title = `${track.title} • ${artist} | Track Vault Player`;

		// Set MediaSession metadata
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: artist,
				album: currentAlbum ? currentAlbum.title : 'Track Vault',
				artwork: currentAlbum?.cover_url
					? [
							{ src: currentAlbum.cover_url, sizes: '300x300', type: 'image/jpeg' },
							{ src: currentAlbum.cover_url, sizes: '512x512', type: 'image/jpeg' }
					  ]
					: []
			});
		}

		if (showLyricsDrawer) {
			loadLyricsForCurrentTrack();
		}
	}

	// Playback Action: Play entire album
	function playAlbum(album: PlayerAlbum) {
		selectedAlbum = album;
		if (album.tracks.length > 0) {
			playTrack(album.tracks[0], album, album.tracks);
		}
	}

	// Play / Pause Toggle
	function togglePlay() {
		if (!audioEl) return;
		if (!currentTrack) {
			if (selectedAlbum && selectedAlbum.tracks.length > 0) {
				playAlbum(selectedAlbum);
			}
			return;
		}

		if (isPlaying) {
			audioEl.pause();
		} else {
			audioEl.play().catch((e) => console.warn('Play error:', e));
		}
	}

	// Next Track
	function nextTrack() {
		if (!activeQueue.length) return;

		if (repeatMode === 'one') {
			if (audioEl) {
				audioEl.currentTime = 0;
				audioEl.play().catch(() => {});
			}
			return;
		}

		if (shuffleEnabled && activeQueue.length > 1) {
			let nextIdx = Math.floor(Math.random() * activeQueue.length);
			if (nextIdx === queueIndex) {
				nextIdx = (nextIdx + 1) % activeQueue.length;
			}
			playTrack(activeQueue[nextIdx], currentAlbum || undefined, activeQueue);
			return;
		}

		if (queueIndex < activeQueue.length - 1) {
			playTrack(activeQueue[queueIndex + 1], currentAlbum || undefined, activeQueue);
		} else if (repeatMode === 'all') {
			playTrack(activeQueue[0], currentAlbum || undefined, activeQueue);
		} else {
			isPlaying = false;
		}
	}

	// Previous Track
	function previousTrack() {
		if (!audioEl || !activeQueue.length) return;

		if (audioEl.currentTime > 3) {
			audioEl.currentTime = 0;
			return;
		}

		if (queueIndex > 0) {
			playTrack(activeQueue[queueIndex - 1], currentAlbum || undefined, activeQueue);
		} else if (repeatMode === 'all') {
			playTrack(activeQueue[activeQueue.length - 1], currentAlbum || undefined, activeQueue);
		} else {
			audioEl.currentTime = 0;
		}
	}

	function seekTo(seconds: number) {
		if (!audioEl) return;
		audioEl.currentTime = Math.max(0, Math.min(duration, seconds));
	}

	function handleVolumeChange(newVol: number) {
		volume = Math.max(0, Math.min(1, newVol));
		isMuted = volume === 0;
		if (audioEl) {
			audioEl.volume = volume;
			audioEl.muted = isMuted;
		}
		try {
			localStorage.setItem('trackvault_player_volume', volume.toString());
		} catch {}
	}

	function toggleMute() {
		isMuted = !isMuted;
		if (audioEl) {
			audioEl.muted = isMuted;
		}
	}

	function toggleShuffle() {
		shuffleEnabled = !shuffleEnabled;
	}

	function toggleRepeat() {
		if (repeatMode === 'off') repeatMode = 'all';
		else if (repeatMode === 'all') repeatMode = 'one';
		else repeatMode = 'off';
	}

	function toggleLyrics() {
		showLyricsDrawer = !showLyricsDrawer;
		if (showLyricsDrawer) {
			showQueueDrawer = false;
			loadLyricsForCurrentTrack();
		}
	}

	function toggleQueue() {
		showQueueDrawer = !showQueueDrawer;
		if (showQueueDrawer) {
			showLyricsDrawer = false;
		}
	}

	// Filtered library albums in sidebar
	let filteredAlbums = $derived.by(() => {
		let list = data.albums;
		if (librarySearch.trim()) {
			const q = librarySearch.trim().toLowerCase();
			list = list.filter(
				(a) =>
					a.title.toLowerCase().includes(q) ||
					a.artist.toLowerCase().includes(q) ||
					(a.genre && a.genre.toLowerCase().includes(q))
			);
		}

		if (libraryFilter === 'verified') {
			list = list.filter((a) => a.checked_count === a.track_count && (a.track_count || 0) > 0);
		} else if (libraryFilter === 'lossless') {
			list = list.filter((a) => a.tracks.some((t) => t.format === 'FLAC' || t.format === 'ALAC' || t.format === 'WAV'));
		}
		return list;
	});

	// Filtered tracks within selected album
	let displayedTracks = $derived.by(() => {
		if (!selectedAlbum) return [];
		if (!albumTrackSearch.trim()) return selectedAlbum.tracks;
		const q = albumTrackSearch.trim().toLowerCase();
		return selectedAlbum.tracks.filter(
			(t) =>
				t.title.toLowerCase().includes(q) ||
				(t.artist && t.artist.toLowerCase().includes(q))
		);
	});

	// Global Keyboard Shortcuts
	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		if (e.code === 'Space') {
			e.preventDefault();
			togglePlay();
		} else if (e.code === 'ArrowLeft') {
			e.preventDefault();
			if (e.shiftKey) {
				previousTrack();
			} else if (audioEl) {
				seekTo(audioEl.currentTime - 5);
			}
		} else if (e.code === 'ArrowRight') {
			e.preventDefault();
			if (e.shiftKey) {
				nextTrack();
			} else if (audioEl) {
				seekTo(audioEl.currentTime + 5);
			}
		} else if (e.code === 'ArrowUp') {
			e.preventDefault();
			handleVolumeChange(volume + 0.05);
		} else if (e.code === 'ArrowDown') {
			e.preventDefault();
			handleVolumeChange(volume - 0.05);
		} else if (e.key.toLowerCase() === 'm') {
			toggleMute();
		} else if (e.key.toLowerCase() === 'l') {
			toggleLyrics();
		}
	}

	onMount(() => {
		// Restore volume
		try {
			const saved = localStorage.getItem('trackvault_player_volume');
			if (saved) {
				volume = parseFloat(saved);
				if (audioEl) audioEl.volume = volume;
			}
		} catch {}

		// Handle initial target from URL parameters
		if (data.initialAlbumId) {
			const found = data.albums.find((a) => a.id === data.initialAlbumId);
			if (found) {
				selectedAlbum = found;
			}
		}

		if (data.initialTrackId) {
			const tr = data.allTracks.find((t) => t.id === data.initialTrackId);
			if (tr) {
				const alb = data.albums.find((a) => a.id === tr.album_id);
				playTrack(tr, alb);
			}
		}

		// Setup MediaSession action handlers
		if ('mediaSession' in navigator) {
			navigator.mediaSession.setActionHandler('play', () => togglePlay());
			navigator.mediaSession.setActionHandler('pause', () => togglePlay());
			navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
			navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (details.seekTime !== undefined) seekTo(details.seekTime);
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Audio Element -->
<audio
	bind:this={audioEl}
	bind:currentTime
	bind:duration
	onplay={() => (isPlaying = true)}
	onpause={() => (isPlaying = false)}
	onended={nextTrack}
	preload="auto"
></audio>

<!-- Spotify Main Application Container -->
<div class="h-screen flex flex-col bg-[#000000] text-neutral-100 font-sans select-none overflow-hidden pb-24">
	<!-- Top Center Section: 3-Column / Dual-pane Spotify Layout -->
	<div class="flex-1 flex overflow-hidden p-2 gap-2">
		<!-- LEFT SIDEBAR: "Your Library" -->
		<aside class="w-72 lg:w-80 bg-[#121212] rounded-xl flex flex-col overflow-hidden shrink-0 border border-neutral-900/60 shadow-lg">
			<!-- Library Header -->
			<div class="p-4 pb-2 border-b border-neutral-800/40">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-2.5 text-neutral-300 font-bold text-sm tracking-wide">
						<Library class="w-5 h-5 text-emerald-400" />
						<span>Your Vault Library</span>
					</div>
					<span class="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
						{data.albums.length} albums
					</span>
				</div>

				<!-- Search Input -->
				<div class="relative">
					<Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
					<input
						type="text"
						bind:value={librarySearch}
						placeholder="Search albums & artists..."
						class="w-full bg-[#242424] text-xs text-white placeholder-neutral-500 rounded-lg pl-8 pr-3 py-2 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
					/>
					{#if librarySearch}
						<button
							type="button"
							onclick={() => (librarySearch = '')}
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
						>
							✕
						</button>
					{/if}
				</div>

				<!-- Filter Chips -->
				<div class="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar pb-1 text-xs">
					{#each [
						{ id: 'all', label: 'All' },
						{ id: 'verified', label: '100% Checked' },
						{ id: 'lossless', label: 'FLAC / Hi-Res' }
					] as chip}
						<button
							type="button"
							onclick={() => (libraryFilter = chip.id as any)}
							class="px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer shrink-0 {libraryFilter === chip.id
								? 'bg-emerald-500 text-black font-semibold shadow-sm'
								: 'bg-[#242424] text-neutral-300 hover:bg-[#2a2a2a]'}"
						>
							{chip.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Albums List -->
			<div class="flex-1 overflow-y-auto p-2 space-y-1">
				{#each filteredAlbums as album}
					{@const isSelected = selectedAlbum?.id === album.id}
					{@const isPlayingThisAlbum = currentAlbum?.id === album.id && isPlaying}
					<div
						role="button"
						tabindex="0"
						onclick={() => (selectedAlbum = album)}
						onkeydown={(e) => {
							if (e.key === 'Enter') selectedAlbum = album;
						}}
						class="w-full flex items-center gap-3 p-2 rounded-lg transition text-left cursor-pointer group {isSelected
							? 'bg-[#282828] text-white shadow-sm'
							: 'text-neutral-300 hover:bg-[#1a1a1a]'}"
					>
						<!-- Album Thumbnail -->
						<div class="relative w-12 h-12 rounded-md overflow-hidden bg-neutral-900 shrink-0 shadow">
							{#if album.cover_url}
								<img src={album.cover_url} alt={album.title} class="w-full h-full object-cover" />
							{:else}
								<div class="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
									<Music class="w-5 h-5" />
								</div>
							{/if}

							{#if isPlayingThisAlbum}
								<div class="absolute inset-0 bg-black/50 flex items-center justify-center">
									<div class="flex items-end gap-0.5 h-3">
										<span class="w-1 bg-[#1ed760] animate-pulse h-full"></span>
										<span class="w-1 bg-[#1ed760] animate-pulse h-2"></span>
										<span class="w-1 bg-[#1ed760] animate-pulse h-full"></span>
									</div>
								</div>
							{/if}
						</div>

						<!-- Details -->
						<div class="min-w-0 flex-1">
							<div class="text-xs font-semibold truncate {isPlayingThisAlbum ? 'text-[#1ed760]' : 'text-white'}">
								{album.title}
							</div>
							<div class="text-[11px] text-neutral-400 truncate mt-0.5">
								{album.artist} &bull; {album.release_year || 'Album'}
							</div>
						</div>

						<!-- Play button on hover -->
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								playAlbum(album);
							}}
							class="p-2 rounded-full bg-[#1ed760] text-black opacity-0 group-hover:opacity-100 transition hover:scale-105 shadow cursor-pointer shrink-0"
							title="Play Album"
						>
							<Play class="w-3.5 h-3.5 fill-current ml-0.5" />
						</button>
					</div>
				{/each}

				{#if filteredAlbums.length === 0}
					<div class="p-6 text-center text-xs text-neutral-500 italic">
						No albums found
					</div>
				{/if}
			</div>
		</aside>

		<!-- MAIN VIEW: Selected Album Header & Tracklist -->
		<main class="flex-1 bg-[#121212] rounded-xl flex flex-col overflow-hidden border border-neutral-900/60 shadow-lg relative">
			{#if selectedAlbum}
				<!-- Album Hero Header (Spotify Gradient Banner) -->
				<div class="p-6 pb-6 bg-gradient-to-b from-neutral-800/80 to-[#121212] flex flex-col sm:flex-row items-center sm:items-end gap-6 shrink-0 border-b border-neutral-800/50">
					<!-- Big Album Artwork -->
					<div class="w-44 h-44 sm:w-52 sm:h-52 rounded-lg overflow-hidden bg-neutral-900 shadow-2xl shrink-0 border border-white/5">
						{#if selectedAlbum.cover_url}
							<img src={selectedAlbum.cover_url} alt={selectedAlbum.title} class="w-full h-full object-cover" />
						{:else}
							<div class="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-600">
								<Disc3 class="w-16 h-16 opacity-30" />
							</div>
						{/if}
					</div>

					<!-- Hero Metadata -->
					<div class="min-w-0 flex-1 text-center sm:text-left space-y-2">
						<span class="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
							Album
						</span>

						<h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2">
							{selectedAlbum.title}
						</h1>

						<div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-neutral-300 pt-1">
							<span class="font-bold text-white hover:underline cursor-pointer">
								{selectedAlbum.artist}
							</span>
							{#if selectedAlbum.release_year}
								<span>&bull;</span>
								<span>{selectedAlbum.release_year}</span>
							{/if}
							<span>&bull;</span>
							<span>{selectedAlbum.tracks.length} songs,</span>
							<span class="text-neutral-400">{formatTotalAlbumDuration(selectedAlbum.tracks)}</span>
							{#if selectedAlbum.genre}
								<span>&bull;</span>
								<span class="px-2 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/50 text-[11px]">
									{selectedAlbum.genre}
								</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Action Bar (Big Spotify Play Button & Filters) -->
				<div class="px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-[#121212]">
					<div class="flex items-center gap-4">
						<!-- Big Green Play Button -->
						<button
							type="button"
							onclick={() => {
								if (currentAlbum?.id === selectedAlbum.id && isPlaying) {
									togglePlay();
								} else {
									playAlbum(selectedAlbum);
								}
							}}
							class="w-14 h-14 rounded-full bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-xl shadow-emerald-950/40 transition cursor-pointer"
							title={currentAlbum?.id === selectedAlbum.id && isPlaying ? 'Pause' : 'Play Album'}
						>
							{#if currentAlbum?.id === selectedAlbum.id && isPlaying}
								<Pause class="w-6 h-6 fill-current" />
							{:else}
								<Play class="w-6 h-6 fill-current ml-0.5" />
							{/if}
						</button>

						<!-- Shuffle Album Button -->
						<button
							type="button"
							onclick={() => {
								shuffleEnabled = !shuffleEnabled;
								if (!isPlaying || currentAlbum?.id !== selectedAlbum.id) {
									playAlbum(selectedAlbum);
								}
							}}
							class="p-2.5 rounded-full transition cursor-pointer {shuffleEnabled ? 'text-[#1ed760] bg-emerald-950/30' : 'text-neutral-400 hover:text-white'}"
							title="Toggle Shuffle"
						>
							<Shuffle class="w-5 h-5" />
						</button>

						<!-- Open Album in Vault -->
						<a
							href="/album/{selectedAlbum.id}"
							class="p-2.5 rounded-full text-neutral-400 hover:text-white transition"
							title="Open Album Details in Vault"
						>
							<ExternalLink class="w-5 h-5" />
						</a>
					</div>

					<!-- Filter Tracks within Album -->
					<div class="relative w-48 sm:w-64">
						<Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
						<input
							type="text"
							bind:value={albumTrackSearch}
							placeholder="Find in album..."
							class="w-full bg-[#242424] text-xs text-white placeholder-neutral-500 rounded-full pl-8 pr-3 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
						/>
					</div>
				</div>

				<!-- Tracklist Table -->
				<div class="flex-1 overflow-y-auto px-6 pb-6">
					<table class="w-full text-left text-xs border-collapse">
						<thead class="text-neutral-400 border-b border-neutral-800/80 sticky top-0 bg-[#121212] z-10">
							<tr class="h-9">
								<th class="w-10 text-center font-normal">#</th>
								<th class="font-normal">Title</th>
								<th class="font-normal hidden md:table-cell">Album</th>
								<th class="font-normal hidden sm:table-cell">Quality</th>
								<th class="font-normal hidden lg:table-cell">Lyrics</th>
								<th class="w-16 text-right pr-4 font-normal"><Clock class="w-3.5 h-3.5 inline" /></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-neutral-900/40">
							{#each displayedTracks as track, idx}
								{@const isCurrent = currentTrack?.id === track.id}
								{@const isCurrentPlaying = isCurrent && isPlaying}
								<tr
									onclick={() => playTrack(track, selectedAlbum, selectedAlbum.tracks)}
									class="group hover:bg-[#282828] transition cursor-pointer rounded-lg h-14 {isCurrent ? 'bg-[#1f1f1f]' : ''}"
								>
									<!-- Track Number / Play Action -->
									<td class="text-center font-mono text-neutral-400 w-10">
										{#if isCurrentPlaying}
											<div class="flex items-end justify-center gap-0.5 h-3.5">
												<span class="w-1 bg-[#1ed760] animate-pulse h-full"></span>
												<span class="w-1 bg-[#1ed760] animate-pulse h-2"></span>
												<span class="w-1 bg-[#1ed760] animate-pulse h-full"></span>
											</div>
										{:else}
											<span class="group-hover:hidden">{track.track_number || idx + 1}</span>
											<Play class="w-3.5 h-3.5 fill-current mx-auto hidden group-hover:block text-white" />
										{/if}
									</td>

									<!-- Track Title & Artist -->
									<td class="py-2 pr-3 min-w-0">
										<div class="font-semibold truncate {isCurrent ? 'text-[#1ed760]' : 'text-white'}">
											{track.title}
										</div>
										<div class="text-[11px] text-neutral-400 truncate mt-0.5">
											{track.artist || selectedAlbum.artist}
										</div>
									</td>

									<!-- Album Title -->
									<td class="hidden md:table-cell text-neutral-400 truncate max-w-xs pr-3">
										{selectedAlbum.title}
									</td>

									<!-- Audio Quality Tag -->
									<td class="hidden sm:table-cell pr-3">
										<span class="px-2 py-0.5 rounded text-[10px] font-mono {track.format === 'FLAC'
											? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
											: 'bg-neutral-800 text-neutral-300 border border-neutral-700/40'}">
											{track.format}
										</span>
									</td>

									<!-- Lyrics Indicator -->
									<td class="hidden lg:table-cell pr-3">
										{#if track.lyrics === 'instrumental'}
											<span class="px-2 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800/50 font-serif">
												♪ Instrumental
											</span>
										{:else if track.lyrics === 'synced_lrc'}
											<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
												Synced LRC
											</span>
										{:else}
											<span class="text-neutral-500 text-[10px]">
												{track.lyrics || 'plain'}
											</span>
										{/if}
									</td>

									<!-- Duration -->
									<td class="text-right pr-4 text-neutral-400 font-mono tabular-nums text-xs">
										{formatDurationMs(track.duration_ms)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500">
					<Disc3 class="w-16 h-16 opacity-30 mb-3" />
					<h3 class="text-base font-bold text-neutral-300">No album selected</h3>
					<p class="text-xs text-neutral-500 mt-1">Choose an album from your vault library on the left to start playback.</p>
				</div>
			{/if}
		</main>

		<!-- RIGHT PANEL: Spotify Synced Lyrics or Queue Drawer -->
		{#if showLyricsDrawer || showQueueDrawer}
			<aside class="w-80 lg:w-96 bg-[#121212] rounded-xl flex flex-col overflow-hidden shrink-0 border border-neutral-900/60 shadow-2xl animate-in slide-in-from-right duration-200">
				<!-- Panel Header -->
				<div class="p-4 border-b border-neutral-800/60 flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if showLyricsDrawer}
							<Mic class="w-4 h-4 text-[#1ed760]" />
							<h3 class="font-bold text-sm text-white">Synced Lyrics</h3>
						{:else}
							<ListMusic class="w-4 h-4 text-[#1ed760]" />
							<h3 class="font-bold text-sm text-white">Play Queue</h3>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => {
							showLyricsDrawer = false;
							showQueueDrawer = false;
						}}
						class="text-neutral-400 hover:text-white p-1"
					>
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Content Body -->
				<div class="flex-1 overflow-y-auto p-4 flex flex-col">
					<!-- MODE A: Synced Lyrics -->
					{#if showLyricsDrawer}
						{#if lyricsLoading}
							<div class="flex-1 flex items-center justify-center text-xs text-neutral-500">
								Loading synced lyrics...
							</div>
						{:else if isInstrumentalLyrics}
							<div class="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
								<div class="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-3xl font-serif">
									♪
								</div>
								<div>
									<h4 class="text-lg font-bold text-white">Instrumental Track</h4>
									<p class="text-xs text-neutral-400 mt-1">This song has no vocal lyrics</p>
								</div>
								<div class="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
									[00:00.00]{instrumentalMarker}
								</div>
							</div>
						{:else if lyricsLines.length > 0}
							<div bind:this={lyricsContainerEl} class="space-y-4 py-8">
								{#each lyricsLines as line, i}
									{@const isActive = activeLyricLineIndex === i}
									<button
										type="button"
										id={`lyrics-line-${i}`}
										onclick={() => line.time !== null && seekTo(line.time)}
										class="w-full text-left transition-all duration-200 cursor-pointer {isActive
											? 'text-lg sm:text-xl font-extrabold text-white scale-[1.02] origin-left'
											: i < activeLyricLineIndex
											? 'text-xs sm:text-sm text-neutral-500 hover:text-neutral-300 font-medium'
											: 'text-xs sm:text-sm text-neutral-400 hover:text-white font-medium'}"
									>
										{line.text}
									</button>
								{/each}
							</div>
						{:else}
							<div class="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-3">
								<Mic class="w-12 h-12 opacity-30" />
								<p class="text-xs">No lyrics found for this song.</p>
								{#if currentTrack}
									<a
										href="/lrc-maker?trackId={currentTrack.id}"
										class="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition"
									>
										Create Synced Lyrics in Studio &rarr;
									</a>
								{/if}
							</div>
						{/if}

					<!-- MODE B: Queue Drawer -->
					{:else if showQueueDrawer}
						<div class="space-y-2">
							<span class="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
								Now Playing
							</span>
							{#if currentTrack}
								<div class="p-3 rounded-lg bg-[#282828] flex items-center gap-3">
									<div class="min-w-0 flex-1">
										<div class="text-xs font-bold text-[#1ed760] truncate">{currentTrack.title}</div>
										<div class="text-[11px] text-neutral-400 truncate">{currentTrack.artist || currentAlbum?.artist}</div>
									</div>
									<span class="text-xs font-mono text-neutral-400">{formatDurationMs(currentTrack.duration_ms)}</span>
								</div>
							{/if}

							<span class="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block pt-4 mb-2">
								Next Up ({Math.max(0, activeQueue.length - queueIndex - 1)})
							</span>
							{#each activeQueue.slice(queueIndex + 1) as nextTr, i}
								<button
									type="button"
									onclick={() => playTrack(nextTr, currentAlbum || undefined, activeQueue)}
									class="w-full text-left p-2.5 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-between gap-3 text-xs text-neutral-300 transition cursor-pointer"
								>
									<div class="min-w-0 flex-1">
										<div class="font-medium text-white truncate">{nextTr.title}</div>
										<div class="text-[11px] text-neutral-400 truncate">{nextTr.artist || currentAlbum?.artist}</div>
									</div>
									<span class="text-[11px] font-mono text-neutral-500">{formatDurationMs(nextTr.duration_ms)}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</aside>
		{/if}
	</div>

	<!-- BOTTOM PERSISTENT PLAYER BAR (Spotify Style) -->
	<footer class="fixed bottom-0 left-0 right-0 h-24 bg-[#181818] border-t border-neutral-800/80 z-50 px-4 flex items-center justify-between gap-4 shadow-2xl">
		<!-- Left: Now Playing Info -->
		<div class="flex items-center gap-3 w-1/4 min-w-[180px]">
			{#if currentTrack}
				<div class="w-14 h-14 rounded-md overflow-hidden bg-neutral-900 shrink-0 shadow-md">
					{#if currentAlbum?.cover_url}
						<img src={currentAlbum.cover_url} alt={currentTrack.title} class="w-full h-full object-cover" />
					{:else}
						<div class="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
							<Music class="w-6 h-6" />
						</div>
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<div class="text-xs sm:text-sm font-semibold text-white truncate hover:underline cursor-pointer">
						{currentTrack.title}
					</div>
					<div class="text-[11px] text-neutral-400 truncate hover:underline cursor-pointer">
						{currentTrack.artist || currentAlbum?.artist || 'Track Vault'}
					</div>
					<div class="mt-0.5">
						<span class="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-700/50 text-emerald-400">
							{currentTrack.format}
						</span>
					</div>
				</div>
			{:else}
				<div class="w-14 h-14 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 shrink-0">
					<Music class="w-6 h-6" />
				</div>
				<div class="min-w-0 flex-1">
					<span class="text-xs text-neutral-500 italic">No track playing</span>
				</div>
			{/if}
		</div>

		<!-- Center: Playback Controls & Progress Scrubber -->
		<div class="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
			<!-- Buttons -->
			<div class="flex items-center gap-4">
				<!-- Shuffle Button -->
				<button
					type="button"
					onclick={toggleShuffle}
					class="p-1.5 rounded-full transition cursor-pointer relative {shuffleEnabled ? 'text-[#1ed760]' : 'text-neutral-400 hover:text-white'}"
					title="Shuffle: {shuffleEnabled ? 'ON' : 'OFF'}"
				>
					<Shuffle class="w-4 h-4" />
					{#if shuffleEnabled}
						<span class="w-1 h-1 rounded-full bg-[#1ed760] absolute bottom-0 left-1/2 -translate-x-1/2"></span>
					{/if}
				</button>

				<!-- Previous Button -->
				<button
					type="button"
					onclick={previousTrack}
					class="text-neutral-400 hover:text-white transition cursor-pointer p-1"
					title="Previous Song (Shift + Left Arrow)"
				>
					<SkipBack class="w-5 h-5 fill-current" />
				</button>

				<!-- Play/Pause Button -->
				<button
					type="button"
					onclick={togglePlay}
					class="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-md transition cursor-pointer"
					title="Play / Pause (Space)"
				>
					{#if isPlaying}
						<Pause class="w-5 h-5 fill-current" />
					{:else}
						<Play class="w-5 h-5 fill-current ml-0.5" />
					{/if}
				</button>

				<!-- Next Button -->
				<button
					type="button"
					onclick={nextTrack}
					class="text-neutral-400 hover:text-white transition cursor-pointer p-1"
					title="Next Song (Shift + Right Arrow)"
				>
					<SkipForward class="w-5 h-5 fill-current" />
				</button>

				<!-- Repeat Button -->
				<button
					type="button"
					onclick={toggleRepeat}
					class="p-1.5 rounded-full transition cursor-pointer relative {repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-neutral-400 hover:text-white'}"
					title="Repeat: {repeatMode}"
				>
					{#if repeatMode === 'one'}
						<Repeat1 class="w-4 h-4" />
					{:else}
						<Repeat class="w-4 h-4" />
					{/if}
					{#if repeatMode !== 'off'}
						<span class="w-1 h-1 rounded-full bg-[#1ed760] absolute bottom-0 left-1/2 -translate-x-1/2"></span>
					{/if}
				</button>
			</div>

			<!-- Seekbar / Scrubber -->
			<div class="w-full flex items-center gap-2 text-[11px] font-mono text-neutral-400 tabular-nums">
				<span class="w-10 text-right">{formatTime(currentTime)}</span>
				<div class="flex-1 relative flex items-center">
					<input
						type="range"
						min="0"
						max={duration || 100}
						step="0.1"
						value={currentTime}
						oninput={(e) => seekTo(parseFloat(e.currentTarget.value))}
						class="w-full h-1 bg-neutral-700 hover:bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
					/>
				</div>
				<span class="w-10 text-left">{formatTime(duration)}</span>
			</div>
		</div>

		<!-- Right: Lyrics, Queue, Volume -->
		<div class="flex items-center justify-end gap-3 w-1/4 min-w-[180px]">
			<!-- Lyrics Drawer Toggle (Spotify Mic Icon) -->
			<button
				type="button"
				onclick={toggleLyrics}
				class="p-2 rounded-full transition cursor-pointer {showLyricsDrawer ? 'text-[#1ed760] bg-emerald-950/40' : 'text-neutral-400 hover:text-white'}"
				title="Synced Lyrics (L)"
			>
				<Mic class="w-4 h-4" />
			</button>

			<!-- Queue Drawer Toggle -->
			<button
				type="button"
				onclick={toggleQueue}
				class="p-2 rounded-full transition cursor-pointer {showQueueDrawer ? 'text-[#1ed760] bg-emerald-950/40' : 'text-neutral-400 hover:text-white'}"
				title="Play Queue"
			>
				<ListMusic class="w-4 h-4" />
			</button>

			<!-- Volume Controls -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={toggleMute}
					class="text-neutral-400 hover:text-white transition cursor-pointer"
					title="Mute / Unmute (M)"
				>
					{#if isMuted || volume === 0}
						<VolumeX class="w-4 h-4" />
					{:else if volume < 0.5}
						<Volume1 class="w-4 h-4" />
					{:else}
						<Volume2 class="w-4 h-4" />
					{/if}
				</button>

				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={isMuted ? 0 : volume}
					oninput={(e) => handleVolumeChange(parseFloat(e.currentTarget.value))}
					class="w-20 sm:w-24 h-1 bg-neutral-700 hover:bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
				/>
			</div>
		</div>
	</footer>
</div>

<style>
	/* Hide standard scrollbars for smooth Spotify pills */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
