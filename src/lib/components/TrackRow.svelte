<script lang="ts">
	import type { Track, AudioFormat, QualityRating, CensorshipStatus, LyricsStatus } from '$lib/types/index.js';
	import {
		formatDuration,
		FORMAT_OPTIONS,
		QUALITY_OPTIONS,
		CENSORSHIP_OPTIONS,
		LYRICS_OPTIONS,
		getFormatBadgeClass
	} from '$lib/utils.js';
	import {
		Trash2,
		AlertTriangle,
		CheckCircle2,
		FileText,
		Disc,
		Clock,
		Mic2,
		Sparkles
	} from '@lucide/svelte';

	interface Props {
		track: Track;
		onTrackUpdated?: (updated: Track) => void;
		onTrackDeleted?: (id: number) => void;
	}

	let { track, onTrackUpdated, onTrackDeleted }: Props = $props();

	let isUpdating = $state(false);
	let showNotes = $state(false);
	let notesValue = $state(track.notes || '');

	async function updateField(field: keyof Track, value: any) {
		isUpdating = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [field]: value })
			});

			if (res.ok) {
				const data = await res.json();
				if (data.track && onTrackUpdated) {
					onTrackUpdated(data.track);
				}
			}
		} catch (err) {
			console.error('Failed to update track:', err);
		} finally {
			isUpdating = false;
		}
	}

	async function saveNotes() {
		await updateField('notes', notesValue);
		showNotes = false;
	}

	async function handleDelete() {
		if (!confirm(`Delete track "${track.title}"?`)) return;
		try {
			const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
			if (res.ok && onTrackDeleted) {
				onTrackDeleted(track.id);
			}
		} catch (err) {
			console.error('Failed to delete track:', err);
		}
	}

	// Quick 1-click toggles
	async function cycleLyrics() {
		const order: LyricsStatus[] = ['missing', 'plain_txt', 'unsynced_lrc', 'synced_lrc', 'instrumental'];
		const nextIdx = (order.indexOf(track.lyrics) + 1) % order.length;
		await updateField('lyrics', order[nextIdx]);
	}

	async function cycleCensorship() {
		const order: CensorshipStatus[] = ['explicit', 'clean_original', 'censored'];
		const nextIdx = (order.indexOf(track.censorship) + 1) % order.length;
		await updateField('censorship', order[nextIdx]);
	}

	async function toggleFlac() {
		const newFormat: AudioFormat = track.format === 'FLAC' ? 'MP3_320' : 'FLAC';
		await updateField('format', newFormat);
	}
</script>

<div
	class="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/60 p-3.5 transition hover:bg-neutral-900/40 {track.needs_attention ? 'border-l-4 border-l-amber-500/80 bg-amber-500/[0.02]' : ''}"
>
	<!-- Left Side: Track Number, Title, Artist -->
	<div class="flex items-center gap-3 min-w-0 flex-1">
		<span class="w-7 text-right text-xs font-mono font-medium text-neutral-500">
			{track.track_number}
		</span>

		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="truncate text-sm font-semibold text-neutral-100" title={track.title}>
					{track.title}
				</span>

				{#if track.needs_attention}
					<span
						class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30"
						title="Needs attention: check quality, censorship, or lyrics"
					>
						<AlertTriangle class="h-3 w-3" />
						Needs Fix
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-3 text-xs text-neutral-400">
				{#if track.artist}
					<span class="truncate text-neutral-400">{track.artist}</span>
					<span>•</span>
				{/if}
				<span class="font-mono text-neutral-500">{formatDuration(track.duration_ms)}</span>

				{#if track.notes}
					<span>•</span>
					<span class="truncate italic text-neutral-500 text-[11px]" title={track.notes}>
						"{track.notes}"
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Right Side: Format, Quality, Censorship, Lyrics Controls -->
	<div class="flex flex-wrap items-center gap-2 sm:justify-end">
		<!-- Audio Format Selector -->
		<div class="relative">
			<select
				value={track.format}
				onchange={(e) => updateField('format', e.currentTarget.value)}
				disabled={isUpdating}
				class="rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-purple-500 {getFormatBadgeClass(track.format)}"
				title="Change audio format"
			>
				{#each FORMAT_OPTIONS as opt}
					<option value={opt.value} class="bg-neutral-900 text-neutral-200">
						{opt.label}
					</option>
				{/each}
			</select>
		</div>

		<!-- Audio Quality Rating Selector -->
		<div class="relative">
			<select
				value={track.quality_rating}
				onchange={(e) => updateField('quality_rating', e.currentTarget.value)}
				disabled={isUpdating}
				class="rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-purple-500 {QUALITY_OPTIONS.find(q => q.value === track.quality_rating)?.color || 'text-neutral-300 bg-neutral-900 border-neutral-800'}"
				title="Audio quality assessment"
			>
				{#each QUALITY_OPTIONS as q}
					<option value={q.value} class="bg-neutral-900 text-neutral-200">
						{q.label}
					</option>
				{/each}
			</select>
		</div>

		<!-- Censorship Toggle Button -->
		<button
			type="button"
			onclick={cycleCensorship}
			disabled={isUpdating}
			class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-95 {CENSORSHIP_OPTIONS.find(c => c.value === track.censorship)?.color || 'text-neutral-300 bg-neutral-900 border-neutral-800'}"
			title="Click to cycle censorship status (Explicit -> Clean -> Censored)"
		>
			{#if track.censorship === 'explicit'}
				<span class="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300">E</span>
				<span>Explicit</span>
			{:else if track.censorship === 'censored'}
				<AlertTriangle class="h-3 w-3 text-rose-400" />
				<span>CENSORED</span>
			{:else if track.censorship === 'clean_original'}
				<span>Clean</span>
			{:else}
				<span>Instrumental</span>
			{/if}
		</button>

		<!-- Lyrics Toggle Button -->
		<button
			type="button"
			onclick={cycleLyrics}
			disabled={isUpdating}
			class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-95 {LYRICS_OPTIONS.find(l => l.value === track.lyrics)?.color || 'text-neutral-300 bg-neutral-900 border-neutral-800'}"
			title="Click to cycle lyrics status (Missing -> Plain TXT -> Synced LRC -> Instrumental)"
		>
			{#if track.lyrics === 'synced_lrc'}
				<CheckCircle2 class="h-3 w-3 text-emerald-400" />
				<span>Synced .LRC</span>
			{:else if track.lyrics === 'plain_txt'}
				<FileText class="h-3 w-3 text-sky-400" />
				<span>Plain TXT</span>
			{:else if track.lyrics === 'missing'}
				<AlertTriangle class="h-3 w-3 text-rose-400" />
				<span>No Lyrics</span>
			{:else}
				<span>No Vocals</span>
			{/if}
		</button>

		<!-- Actions: Notes & Delete -->
		<div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
			<button
				type="button"
				onclick={() => (showNotes = !showNotes)}
				class="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
				title="Add or edit notes"
			>
				<FileText class="h-3.5 w-3.5" />
			</button>

			<button
				type="button"
				onclick={handleDelete}
				class="rounded p-1 text-neutral-500 hover:bg-rose-950/50 hover:text-rose-400"
				title="Delete track"
			>
				<Trash2 class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>
</div>

<!-- Inline Notes Editor Drawer -->
{#if showNotes}
	<div class="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/90 px-8 py-2.5">
		<input
			type="text"
			bind:value={notesValue}
			placeholder="Notes for this track (e.g. 'needs vinyl rip replacement', 'radio muted curse at 1:45', etc.)"
			class="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
		/>
		<button
			type="button"
			onclick={saveNotes}
			class="rounded-lg bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500"
		>
			Save
		</button>
		<button
			type="button"
			onclick={() => (showNotes = false)}
			class="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
		>
			Cancel
		</button>
	</div>
{/if}
