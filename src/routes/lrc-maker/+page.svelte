<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types.js';
	import {
		Play,
		Pause,
		RotateCcw,
		RotateCw,
		Download,
		Copy,
		Save,
		Upload,
		Search,
		FileText,
		Check,
		AlertCircle,
		Trash2,
		Plus,
		Clock,
		Music,
		Mic,
		ArrowLeft,
		ExternalLink,
		ChevronUp,
		ChevronDown,
		Sparkles,
		Eye,
		Edit3,
		Volume2
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	interface LyricLine {
		id: string;
		time: number | null; // Seconds, e.g. 14.25
		text: string;
	}

	// Audio Player State
	let audioEl: HTMLAudioElement | null = $state(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let playbackRate = $state(1.0);
	let audioSrc = $state<string>('');
	let audioFileName = $state<string>('');
	let isUsingServerAudio = $state(false);

	// Editor & Sync State
	type EditorMode = 'text' | 'sync' | 'preview';
	let currentMode = $state<EditorMode>('sync');
	let rawLyricsText = $state('');
	let lyricLines = $state<LyricLine[]>([]);
	let activeLineIndex = $state(0);

	// Track Info State (can be edited if standalone)
	let trackTitle = $state(data.track?.title || '');
	let trackArtist = $state(data.track?.artist || data.track?.album_artist || '');
	let albumTitle = $state(data.track?.album_title || '');

	// LRCLIB & Status State
	let isFetchingLrcLib = $state(false);
	let lrcLibResult = $state<{
		plainLyrics: string | null;
		syncedLyrics: string | null;
		instrumental: boolean;
		trackName: string;
		artistName: string;
	} | null>(null);
	let showLrcLibModal = $state(false);

	let saveStatus = $state<{
		type: 'success' | 'error' | 'info';
		message: string;
	} | null>(null);
	let isSaving = $state(false);
	let copiedNotification = $state(false);

	// Reference to lines scroll container
	let linesContainerEl: HTMLDivElement | null = $state(null);

	// Helpers: Format Seconds to mm:ss.xx
	function formatTime(seconds: number): string {
		if (isNaN(seconds) || seconds < 0) return '00:00.00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 100);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
	}

	// Helpers: Format mm:ss without hundredths
	function formatDurationShort(seconds: number): string {
		if (isNaN(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	// Helpers: Parse [mm:ss.xx] or [mm:ss] timestamp to seconds
	function parseTimestamp(timestamp: string): number | null {
		const match = timestamp.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/);
		if (!match) return null;
		const m = parseInt(match[1], 10);
		const s = parseInt(match[2], 10);
		const msStr = match[3] || '0';
		const ms = parseFloat(`0.${msStr}`);
		return m * 60 + s + ms;
	}

	// Parse LRC or Plain string into LyricLine array
	function parseLyrics(content: string): LyricLine[] {
		const lines = content.split('\n');
		const result: LyricLine[] = [];

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;

			// Skip metadata tags like [ti:], [ar:], [al:]
			if (/^\[(ti|ar|al|length|by|offset|re|ve):/i.test(line)) {
				continue;
			}

			// Check for timestamp [mm:ss.xx]
			const timeMatch = line.match(/^(\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])(.*)$/);
			if (timeMatch) {
				const time = parseTimestamp(timeMatch[1]);
				const text = timeMatch[2].trim();
				result.push({
					id: Math.random().toString(36).slice(2, 9),
					time,
					text
				});
			} else {
				result.push({
					id: Math.random().toString(36).slice(2, 9),
					time: null,
					text: line
				});
			}
		}

		return result.length > 0
			? result
			: [
					{ id: '1', time: null, text: 'First line of lyrics' },
					{ id: '2', time: null, text: 'Second line of lyrics' }
			  ];
	}

	// Generate standard .lrc file text with metadata
	function generateLrcContent(): string {
		const header: string[] = [];
		if (trackTitle) header.push(`[ti:${trackTitle}]`);
		if (trackArtist) header.push(`[ar:${trackArtist}]`);
		if (albumTitle) header.push(`[al:${albumTitle}]`);
		if (duration > 0) header.push(`[length:${formatDurationShort(duration)}]`);
		header.push('[by:Track Vault]');
		header.push('');

		const body = lyricLines.map((l) => {
			if (l.time !== null) {
				return `[${formatTime(l.time)}] ${l.text}`;
			}
			return l.text;
		});

		return [...header, ...body].join('\n');
	}

	// Initial Setup on Mount
	onMount(() => {
		// 1. If server has audio, default to server stream
		if (data.track && data.hasServerAudio) {
			audioSrc = `/api/tracks/${data.track.id}/audio`;
			isUsingServerAudio = true;
			audioFileName = `Server Audio (${data.track.format})`;
		}

		// 2. Load existing lyrics from track or database
		if (data.existingLyrics && data.existingLyrics.trim()) {
			rawLyricsText = data.existingLyrics;
			lyricLines = parseLyrics(data.existingLyrics);
		} else {
			rawLyricsText = '';
			lyricLines = [
				{ id: '1', time: null, text: 'Click "Fetch from LRCLIB" or paste your lyrics in Edit Text mode' },
				{ id: '2', time: null, text: 'Press Space to play and tag timestamps line by line' }
			];
		}
	});

	// Audio Player Controls
	function togglePlay() {
		if (!audioEl) return;
		if (isPlaying) {
			audioEl.pause();
		} else {
			audioEl.play().catch((err) => {
				console.warn('Playback error:', err);
			});
		}
	}

	function seekBackward(seconds = 3) {
		if (!audioEl) return;
		audioEl.currentTime = Math.max(0, audioEl.currentTime - seconds);
	}

	function seekForward(seconds = 3) {
		if (!audioEl) return;
		audioEl.currentTime = Math.min(duration, audioEl.currentTime + seconds);
	}

	function seekTo(time: number) {
		if (!audioEl) return;
		audioEl.currentTime = Math.max(0, Math.min(duration, time));
	}

	function setSpeed(speed: number) {
		playbackRate = speed;
		if (audioEl) audioEl.playbackRate = speed;
	}

	// Local Audio File Upload
	function handleLocalAudioUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			if (audioSrc && !isUsingServerAudio) {
				URL.revokeObjectURL(audioSrc);
			}
			audioSrc = URL.createObjectURL(file);
			audioFileName = file.name;
			isUsingServerAudio = false;
			if (!trackTitle) {
				const baseName = file.name.replace(/\.[^/.]+$/, '');
				trackTitle = baseName;
			}
		}
	}

	// Sync Engine: Stamp current line
	function stampCurrentLine() {
		if (!audioEl) return;

		// If audio paused, start playback
		if (!isPlaying) {
			audioEl.play().catch(() => {});
		}

		if (activeLineIndex < lyricLines.length) {
			const line = lyricLines[activeLineIndex];
			line.time = Math.round(audioEl.currentTime * 100) / 100;

			// Advance to next line
			if (activeLineIndex < lyricLines.length - 1) {
				activeLineIndex++;
				scrollToActiveLine();
			}
		}
	}

	// Sync Engine: Step back
	function stepBackLine() {
		if (activeLineIndex > 0) {
			activeLineIndex--;
			const line = lyricLines[activeLineIndex];
			// Jump audio to slightly before this line if tagged
			if (line.time !== null && audioEl) {
				audioEl.currentTime = Math.max(0, line.time - 0.5);
			}
			scrollToActiveLine();
		}
	}

	// Fine-tuning adjustment (+/- seconds)
	function adjustLineTime(index: number, delta: number) {
		const line = lyricLines[index];
		if (line.time !== null) {
			line.time = Math.max(0, Math.round((line.time + delta) * 100) / 100);
		} else if (audioEl) {
			line.time = Math.max(0, Math.round((audioEl.currentTime + delta) * 100) / 100);
		}
	}

	function removeTimestamp(index: number) {
		lyricLines[index].time = null;
	}

	function selectLine(index: number) {
		activeLineIndex = index;
		const line = lyricLines[index];
		if (line.time !== null && audioEl) {
			audioEl.currentTime = line.time;
		}
	}

	function scrollToActiveLine() {
		tick().then(() => {
			const el = document.getElementById(`line-${activeLineIndex}`);
			if (el && linesContainerEl) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		});
	}

	// Karaoke Preview: Compute current active singing line based on audio time
	let karaokeActiveIndex = $derived(() => {
		let idx = -1;
		for (let i = 0; i < lyricLines.length; i++) {
			const line = lyricLines[i];
			if (line.time !== null && line.time <= currentTime) {
				idx = i;
			}
		}
		return idx;
	});

	// Global Keyboard Hotkeys
	function handleKeyDown(e: KeyboardEvent) {
		// Ignore hotkeys when typing in input, textarea, or contentEditable
		const target = e.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable
		) {
			return;
		}

		if (e.code === 'Space') {
			e.preventDefault();
			if (currentMode === 'sync') {
				stampCurrentLine();
			} else {
				togglePlay();
			}
		} else if (e.code === 'Enter') {
			e.preventDefault();
			if (currentMode === 'sync') {
				stampCurrentLine();
			}
		} else if (e.code === 'ArrowUp') {
			e.preventDefault();
			stepBackLine();
		} else if (e.code === 'ArrowDown') {
			e.preventDefault();
			if (activeLineIndex < lyricLines.length - 1) {
				activeLineIndex++;
				scrollToActiveLine();
			}
		} else if (e.code === 'ArrowLeft') {
			e.preventDefault();
			seekBackward(3);
		} else if (e.code === 'ArrowRight') {
			e.preventDefault();
			seekForward(3);
		}
	}

	// LRCLIB Fetch
	async function fetchFromLrcLib() {
		if (!trackTitle.trim()) {
			saveStatus = { type: 'error', message: 'Enter a track title first to search LRCLIB' };
			return;
		}

		isFetchingLrcLib = true;
		saveStatus = null;

		try {
			const params = new URLSearchParams();
			params.set('track', trackTitle.trim());
			if (trackArtist.trim()) params.set('artist', trackArtist.trim());
			if (albumTitle.trim()) params.set('album', albumTitle.trim());
			if (duration > 0) params.set('duration', Math.round(duration).toString());

			const res = await fetch(`/api/lyrics/search?${params.toString()}`);
			const json = await res.json();

			if (json.success) {
				lrcLibResult = json;
				showLrcLibModal = true;
			} else {
				saveStatus = {
					type: 'info',
					message: json.message || 'No lyrics found on LRCLIB for this song'
				};
			}
		} catch (err: any) {
			saveStatus = { type: 'error', message: `LRCLIB error: ${err.message}` };
		} finally {
			isFetchingLrcLib = false;
		}
	}

	function applyLrcLibLyrics(type: 'synced' | 'plain') {
		if (!lrcLibResult) return;
		const text = type === 'synced' ? lrcLibResult.syncedLyrics : lrcLibResult.plainLyrics;
		if (text) {
			rawLyricsText = text;
			lyricLines = parseLyrics(text);
			activeLineIndex = 0;
			showLrcLibModal = false;
			saveStatus = {
				type: 'success',
				message: `Loaded ${type === 'synced' ? 'synced .lrc' : 'plain'} lyrics from LRCLIB!`
			};
		}
	}

	// Switch from Text Mode to Sync Mode
	function applyRawText() {
		lyricLines = parseLyrics(rawLyricsText);
		activeLineIndex = 0;
		currentMode = 'sync';
	}

	// Save to Track Vault
	async function saveToTrackVault() {
		if (!data.track) {
			saveStatus = {
				type: 'info',
				message: 'No Track Vault track associated. Use "Download .lrc" or "Copy LRC" instead.'
			};
			return;
		}

		isSaving = true;
		saveStatus = null;

		try {
			const content = generateLrcContent();
			const res = await fetch(`/api/tracks/${data.track.id}/lyrics`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lyrics_text: content,
					status: 'synced_lrc',
					save_to_disk: true
				})
			});

			const json = await res.json();
			if (json.success) {
				if (json.saved_to_disk) {
					saveStatus = {
						type: 'success',
						message: 'Saved to Track Vault database and companion .lrc file written to server!'
					};
				} else if (json.disk_error) {
					saveStatus = {
						type: 'info',
						message: `Saved to Track Vault database! (${json.disk_error})`
					};
				} else {
					saveStatus = {
						type: 'success',
						message: 'Saved to Track Vault database! Lyrics status updated to Synced LRC.'
					};
				}
			} else {
				saveStatus = { type: 'error', message: json.error || 'Failed to save lyrics' };
			}
		} catch (err: any) {
			saveStatus = { type: 'error', message: err.message || 'Network error saving lyrics' };
		} finally {
			isSaving = false;
		}
	}

	// Download .lrc file
	function downloadLrcFile() {
		const content = generateLrcContent();
		const filename = `${trackArtist ? trackArtist + ' - ' : ''}${trackTitle || 'lyrics'}.lrc`.replace(
			/[/\\?%*:|"<>]/g,
			'-'
		);

		const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Copy to Clipboard
	async function copyLrcToClipboard() {
		const content = generateLrcContent();
		try {
			await navigator.clipboard.writeText(content);
			copiedNotification = true;
			setTimeout(() => {
				copiedNotification = false;
			}, 2500);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col pb-16">
	<!-- Hidden HTML5 Audio Element -->
	{#if audioSrc}
		<audio
			bind:this={audioEl}
			src={audioSrc}
			bind:currentTime
			bind:duration
			onplay={() => (isPlaying = true)}
			onpause={() => (isPlaying = false)}
			onended={() => (isPlaying = false)}
			preload="auto"
		></audio>
	{/if}

	<!-- Top Navigation / Header -->
	<header class="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-30 px-4 py-3">
		<div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				{#if data.track}
					<a
						href="/album/{data.track.album_id}"
						class="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition px-2 py-1 rounded bg-neutral-800/60"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						Back to Album
					</a>
				{:else}
					<a
						href="/"
						class="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition px-2 py-1 rounded bg-neutral-800/60"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						Vault
					</a>
				{/if}

				<div class="flex items-center gap-2">
					<div class="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
						<Mic class="w-4 h-4" />
					</div>
					<div>
						<h1 class="text-sm font-bold text-white flex items-center gap-2">
							LRC Maker
							<span class="text-[10px] font-normal uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
								Studio
							</span>
						</h1>
					</div>
				</div>
			</div>

			<!-- Quick Actions: LRCLIB & Save -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={fetchFromLrcLib}
					disabled={isFetchingLrcLib}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition text-xs font-medium cursor-pointer disabled:opacity-50"
				>
					<Sparkles class="w-3.5 h-3.5 text-indigo-400 {isFetchingLrcLib ? 'animate-spin' : ''}" />
					{isFetchingLrcLib ? 'Searching...' : 'Fetch from LRCLIB'}
				</button>

				{#if data.track}
					<button
						type="button"
						onclick={saveToTrackVault}
						disabled={isSaving}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition text-xs font-semibold shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
					>
						<Save class="w-3.5 h-3.5" />
						{isSaving ? 'Saving...' : 'Save to Track Vault'}
					</button>
				{/if}

				<button
					type="button"
					onclick={downloadLrcFile}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition text-xs font-medium cursor-pointer"
					title="Download .lrc file"
				>
					<Download class="w-3.5 h-3.5 text-neutral-400" />
					Download .lrc
				</button>

				<button
					type="button"
					onclick={copyLrcToClipboard}
					class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition text-xs font-medium cursor-pointer"
					title="Copy LRC text to clipboard"
				>
					{#if copiedNotification}
						<Check class="w-3.5 h-3.5 text-emerald-400" />
						<span class="text-emerald-400 text-xs">Copied!</span>
					{:else}
						<Copy class="w-3.5 h-3.5 text-neutral-400" />
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- Main Studio Container -->
	<main class="max-w-6xl mx-auto w-full px-4 pt-4 flex-1 flex flex-col gap-4">
		<!-- Notification Alert Banner -->
		{#if saveStatus}
			<div
				class="rounded-xl p-3 border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 {saveStatus.type ===
				'success'
					? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
					: saveStatus.type === 'error'
					? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
					: 'bg-neutral-900 border-neutral-700 text-neutral-300'}"
			>
				<div class="flex items-center gap-2">
					{#if saveStatus.type === 'success'}
						<Check class="w-4 h-4 text-emerald-400 shrink-0" />
					{:else if saveStatus.type === 'error'}
						<AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
					{:else}
						<AlertCircle class="w-4 h-4 text-neutral-400 shrink-0" />
					{/if}
					<span>{saveStatus.message}</span>
				</div>
				<button
					type="button"
					onclick={() => (saveStatus = null)}
					class="text-neutral-400 hover:text-white text-xs px-1.5 py-0.5"
				>
					✕
				</button>
			</div>
		{/if}

		<!-- Track & Audio Source Banner -->
		<div class="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
				<!-- Track Details -->
				<div class="md:col-span-2 flex items-center gap-3">
					{#if data.track?.album_cover_url}
						<img
							src={data.track.album_cover_url}
							alt={data.track.album_title}
							class="w-12 h-12 rounded-lg object-cover border border-neutral-800 shadow-md shrink-0"
						/>
					{:else}
						<div class="w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
							<Music class="w-6 h-6 text-neutral-500" />
						</div>
					{/if}

					<div class="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
						<div>
							<span class="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Title</span>
							<input
								type="text"
								bind:value={trackTitle}
								placeholder="Track Title"
								class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
							/>
						</div>
						<div>
							<span class="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Artist</span>
							<input
								type="text"
								bind:value={trackArtist}
								placeholder="Artist"
								class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
							/>
						</div>
					</div>
				</div>

				<!-- Audio File Selector -->
				<div class="flex flex-col gap-1.5 text-xs">
					<span class="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Audio Source</span>
					<div class="flex items-center gap-2">
						{#if isUsingServerAudio}
							<div class="flex-1 truncate bg-neutral-950 border border-emerald-500/30 rounded px-2.5 py-1 text-emerald-400 flex items-center gap-1.5">
								<Volume2 class="w-3.5 h-3.5 shrink-0" />
								<span class="truncate">{audioFileName}</span>
							</div>
						{:else if audioFileName}
							<div class="flex-1 truncate bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-neutral-300 flex items-center gap-1.5">
								<Music class="w-3.5 h-3.5 shrink-0 text-neutral-500" />
								<span class="truncate">{audioFileName}</span>
							</div>
						{:else}
							<div class="flex-1 truncate bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-neutral-500 italic">
								No audio file loaded
							</div>
						{/if}

						<label
							class="cursor-pointer px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs shrink-0 flex items-center gap-1 font-medium transition"
						>
							<Upload class="w-3.5 h-3.5" />
							<span>Load File</span>
							<input
								type="file"
								accept="audio/*,.flac,.mp3,.wav,.ogg,.m4a"
								onchange={handleLocalAudioUpload}
								class="hidden"
							/>
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- Audio Player Toolbar -->
		<div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 shadow-xl">
			<!-- Timeline Slider -->
			<div class="flex items-center gap-3 mb-3">
				<span class="font-mono text-xs text-emerald-400 w-16 text-right tabular-nums">
					{formatTime(currentTime)}
				</span>
				<div class="flex-1 relative flex items-center">
					<input
						type="range"
						min="0"
						max={duration || 100}
						step="0.01"
						value={currentTime}
						oninput={(e) => seekTo(parseFloat(e.currentTarget.value))}
						class="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
					/>
				</div>
				<span class="font-mono text-xs text-neutral-500 w-16 tabular-nums">
					{formatTime(duration)}
				</span>
			</div>

			<!-- Player Control Buttons -->
			<div class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => seekBackward(3)}
						class="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
						title="Rewind 3s (Left Arrow)"
					>
						<RotateCcw class="w-4 h-4" />
					</button>

					<button
						type="button"
						onclick={togglePlay}
						class="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20 transition cursor-pointer"
						title="Play / Pause (Space)"
					>
						{#if isPlaying}
							<Pause class="w-5 h-5 fill-current" />
						{:else}
							<Play class="w-5 h-5 fill-current ml-0.5" />
						{/if}
					</button>

					<button
						type="button"
						onclick={() => seekForward(3)}
						class="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
						title="Forward 3s (Right Arrow)"
					>
						<RotateCw class="w-4 h-4" />
					</button>
				</div>

				<!-- Playback Speed -->
				<div class="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs">
					<span class="text-[10px] text-neutral-500 uppercase px-1 font-semibold">Speed</span>
					{#each [0.5, 0.75, 1.0, 1.25] as spd}
						<button
							type="button"
							onclick={() => setSpeed(spd)}
							class="px-2 py-0.5 rounded text-xs transition cursor-pointer {playbackRate === spd
								? 'bg-emerald-500 text-black font-semibold'
								: 'text-neutral-400 hover:text-white'}"
						>
							{spd}x
						</button>
					{/each}
				</div>

				<!-- Mode Tabs -->
				<div class="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs">
					<button
						type="button"
						onclick={() => (currentMode = 'text')}
						class="flex items-center gap-1 px-3 py-1 rounded transition cursor-pointer {currentMode === 'text'
							? 'bg-neutral-800 text-white font-medium'
							: 'text-neutral-400 hover:text-white'}"
					>
						<Edit3 class="w-3.5 h-3.5" />
						Edit Text
					</button>

					<button
						type="button"
						onclick={() => (currentMode = 'sync')}
						class="flex items-center gap-1 px-3 py-1 rounded transition cursor-pointer {currentMode === 'sync'
							? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30'
							: 'text-neutral-400 hover:text-white'}"
					>
						<Clock class="w-3.5 h-3.5" />
						Synchronize
					</button>

					<button
						type="button"
						onclick={() => (currentMode = 'preview')}
						class="flex items-center gap-1 px-3 py-1 rounded transition cursor-pointer {currentMode === 'preview'
							? 'bg-neutral-800 text-white font-medium'
							: 'text-neutral-400 hover:text-white'}"
					>
						<Eye class="w-3.5 h-3.5" />
						Karaoke Live
					</button>
				</div>
			</div>
		</div>

		<!-- Main Workspace Area -->
		<div class="flex-1 flex flex-col min-h-[460px]">
			<!-- MODE 1: RAW TEXT EDITOR -->
			{#if currentMode === 'text'}
				<div class="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex-1 flex flex-col gap-3">
					<div class="flex items-center justify-between text-xs text-neutral-400">
						<span>Paste or type your lyrics line by line:</span>
						<span class="text-[11px] text-neutral-500">Supports plain text or existing [mm:ss.xx] .lrc</span>
					</div>
					<textarea
						bind:value={rawLyricsText}
						placeholder="Paste lyrics here..."
						rows="16"
						class="w-full flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
					></textarea>
					<div class="flex items-center justify-between pt-1">
						<span class="text-[11px] text-neutral-500">
							{rawLyricsText.split('\n').filter((l) => l.trim()).length} lines detected
						</span>
						<button
							type="button"
							onclick={applyRawText}
							class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-md"
						>
							Apply to Synchronizer &rarr;
						</button>
					</div>
				</div>

			<!-- MODE 2: INTERACTIVE SYNCHRONIZER -->
			{:else if currentMode === 'sync'}
				<div class="bg-neutral-900 rounded-xl border border-neutral-800 flex-1 flex flex-col overflow-hidden shadow-xl">
					<!-- Sync Actions Sticky Header -->
					<div class="bg-neutral-900/90 border-b border-neutral-800 p-3 flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={stampCurrentLine}
								class="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-2"
							>
								<Clock class="w-4 h-4 fill-current" />
								<span>Stamp Line (Space / Enter)</span>
							</button>

							<button
								type="button"
								onclick={stepBackLine}
								disabled={activeLineIndex === 0}
								class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs transition cursor-pointer border border-neutral-700 disabled:opacity-40 flex items-center gap-1.5"
								title="Step back to re-record previous line (Up Arrow)"
							>
								<ChevronUp class="w-4 h-4" />
								<span>Step Back</span>
							</button>
						</div>

						<div class="text-xs text-neutral-400 flex items-center gap-3">
							<span>Line {activeLineIndex + 1} of {lyricLines.length}</span>
							<span class="text-neutral-600">•</span>
							<span class="hidden sm:inline">Use <kbd class="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 text-[10px]">Space</kbd> to stamp & advance</span>
						</div>
					</div>

					<!-- Scrollable Lines Canvas -->
					<div
						bind:this={linesContainerEl}
						class="flex-1 overflow-y-auto p-4 space-y-2 max-h-[500px]"
					>
						{#each lyricLines as line, i}
							<div
								id={`line-${i}`}
								class="flex items-center gap-3 p-2.5 rounded-xl border transition {i === activeLineIndex
									? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-md'
									: line.time !== null
									? 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
									: 'bg-neutral-950/30 border-neutral-850 opacity-80'}"
							>
								<!-- Line Index / Arrow -->
								<div class="w-6 text-center text-[11px] font-mono text-neutral-500 shrink-0">
									{#if i === activeLineIndex}
										<span class="text-emerald-400 font-bold">&rarr;</span>
									{:else}
										{i + 1}
									{/if}
								</div>

								<!-- Timestamp Chip -->
								<div class="shrink-0">
									{#if line.time !== null}
										<button
											type="button"
											onclick={() => seekTo(line.time!)}
											class="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
											title="Click to seek audio to this timestamp"
										>
											<Play class="w-2.5 h-2.5 fill-current" />
											{formatTime(line.time)}
										</button>
									{:else}
										<button
											type="button"
											onclick={() => {
												activeLineIndex = i;
												stampCurrentLine();
											}}
											class="px-2 py-1 rounded bg-neutral-800/80 border border-neutral-700 text-neutral-400 text-xs hover:text-white transition cursor-pointer"
										>
											--:--.--
										</button>
									{/if}
								</div>

								<!-- Line Text (Editable or clickable) -->
								<div class="flex-1 min-w-0">
									<input
										type="text"
										bind:value={line.text}
										onfocus={() => (activeLineIndex = i)}
										class="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 px-1 {i ===
										activeLineIndex
											? 'text-white font-semibold'
											: line.time !== null
											? 'text-neutral-200'
											: 'text-neutral-400'}"
									/>
								</div>

								<!-- Micro Fine-tuning Actions -->
								<div class="flex items-center gap-1 shrink-0 opacity-80 hover:opacity-100">
									<button
										type="button"
										onclick={() => adjustLineTime(i, -0.1)}
										class="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition"
										title="Nudge -0.1s"
									>
										-0.1s
									</button>
									<button
										type="button"
										onclick={() => adjustLineTime(i, 0.1)}
										class="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition"
										title="Nudge +0.1s"
									>
										+0.1s
									</button>

									{#if line.time !== null}
										<button
											type="button"
											onclick={() => removeTimestamp(i)}
											class="p-1 rounded text-neutral-500 hover:text-rose-400 transition"
											title="Clear timestamp"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

			<!-- MODE 3: KARAOKE LIVE PREVIEW -->
			{:else if currentMode === 'preview'}
				<div class="bg-neutral-900 rounded-xl border border-neutral-800 flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[460px] overflow-hidden relative">
					<div class="max-w-2xl w-full space-y-6">
						{#each lyricLines as line, i}
							{#if Math.abs(i - karaokeActiveIndex()) <= 2}
								<div
									class="transition-all duration-300 transform {i === karaokeActiveIndex()
										? 'text-2xl md:text-3xl font-extrabold text-emerald-400 scale-105 py-2'
										: i < karaokeActiveIndex()
										? 'text-sm md:text-base text-neutral-500'
										: 'text-sm md:text-base text-neutral-400'}"
								>
									{line.text}
								</div>
							{/if}
						{/each}

						{#if karaokeActiveIndex() === -1}
							<div class="text-neutral-500 italic text-sm">
								Press Play to start karaoke preview...
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- LRCLIB Results Modal -->
{#if showLrcLibModal && lrcLibResult}
	<div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-neutral-800 pb-3">
				<div class="flex items-center gap-2">
					<Sparkles class="w-5 h-5 text-indigo-400" />
					<h3 class="font-bold text-white text-base">LRCLIB Results Found</h3>
				</div>
				<button
					type="button"
					onclick={() => (showLrcLibModal = false)}
					class="text-neutral-400 hover:text-white"
				>
					✕
				</button>
			</div>

			<div class="text-xs text-neutral-300 space-y-2">
				<p>
					Found lyrics for: <strong class="text-white">{lrcLibResult.artistName} - {lrcLibResult.trackName}</strong>
				</p>

				<div class="grid grid-cols-2 gap-2 pt-2">
					<div class="p-3 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col justify-between gap-3">
						<div>
							<span class="font-semibold text-white block mb-1">Plain Lyrics</span>
							<p class="text-[11px] text-neutral-400">
								{lrcLibResult.plainLyrics ? 'Available to synchronize freshly with audio' : 'Not available'}
							</p>
						</div>
						<button
							type="button"
							onclick={() => applyLrcLibLyrics('plain')}
							disabled={!lrcLibResult.plainLyrics}
							class="w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition cursor-pointer disabled:opacity-40"
						>
							Load Plain Lyrics
						</button>
					</div>

					<div class="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 flex flex-col justify-between gap-3">
						<div>
							<span class="font-semibold text-indigo-300 block mb-1">Synced LRC</span>
							<p class="text-[11px] text-neutral-400">
								{lrcLibResult.syncedLyrics ? 'Ready-to-use timestamps included' : 'Not available'}
							</p>
						</div>
						<button
							type="button"
							onclick={() => applyLrcLibLyrics('synced')}
							disabled={!lrcLibResult.syncedLyrics}
							class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer disabled:opacity-40"
						>
							Load Synced Lyrics
						</button>
					</div>
				</div>
			</div>

			<div class="pt-2 flex justify-end">
				<button
					type="button"
					onclick={() => (showLrcLibModal = false)}
					class="px-4 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
