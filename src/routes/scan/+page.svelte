<script lang="ts">
	import type { PageData } from './$types.js';
	import type { ScannedAlbum, ScannedTrack } from '$lib/types/index.js';
	import {
		formatDuration,
		FORMAT_OPTIONS,
		QUALITY_OPTIONS,
		CENSORSHIP_OPTIONS,
		LYRICS_OPTIONS,
		getFormatBadgeClass
	} from '$lib/utils.js';
	import {
		FolderSync,
		Disc,
		Disc3,
		CheckCircle2,
		AlertTriangle,
		ExternalLink,
		Sparkles,
		Layers,
		Check,
		ChevronDown,
		ChevronUp,
		Folder,
		ShieldAlert,
		FileText,
		ArrowRight
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let libraryPathInput = $state(data.libraryPath);
	let isScanning = $state(false);
	let scannedAlbums = $state<ScannedAlbum[]>(JSON.parse(JSON.stringify(data.albums)));
	let totalFiles = $state(data.totalFiles);
	let dirExists = $state(data.exists);

	// Expanded album cards map
	let expandedAlbums = $state<{ [key: string]: boolean }>({});
	let importingAlbumKey = $state<string | null>(null);
	let importedAlbumIds = $state<{ [key: string]: number }>({});

	// Keep updated if server data changes
	$effect(() => {
		scannedAlbums = JSON.parse(JSON.stringify(data.albums));
		totalFiles = data.totalFiles;
		dirExists = data.exists;
		libraryPathInput = data.libraryPath;
	});

	function toggleExpand(key: string) {
		expandedAlbums[key] = !expandedAlbums[key];
	}

	function toggleAlbumSelected(album: ScannedAlbum) {
		album.selected = !album.selected;
		for (const tr of album.tracks) {
			tr.selected = album.selected;
		}
	}

	function toggleTrackSelected(album: ScannedAlbum, track: ScannedTrack) {
		track.selected = !track.selected;
		album.selected = album.tracks.some((t) => t.selected);
	}

	function selectAllTracks(album: ScannedAlbum, select: boolean) {
		album.selected = select;
		for (const tr of album.tracks) {
			tr.selected = select;
		}
	}

	async function rescan() {
		isScanning = true;
		try {
			const res = await fetch(`/api/library/scan?path=${encodeURIComponent(libraryPathInput.trim())}`);
			if (res.ok) {
				const result = await res.json();
				scannedAlbums = result.albums;
				totalFiles = result.totalFiles;
				dirExists = result.exists;
			}
		} catch (err) {
			console.error('Scan failed:', err);
		} finally {
			isScanning = false;
		}
	}

	async function importSingleAlbum(album: ScannedAlbum) {
		const selectedPaths = album.tracks.filter((t) => t.selected).map((t) => t.file_path);
		if (selectedPaths.length === 0) {
			alert('Please select at least one song to import from this album.');
			return;
		}

		importingAlbumKey = album.album_key;
		try {
			const res = await fetch('/api/library/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					album,
					selectedTrackPaths: selectedPaths
				})
			});

			if (res.ok) {
				const data = await res.json();
				album.already_in_vault = true;
				importedAlbumIds[album.album_key] = data.albumId;
				await invalidateAll();
			} else {
				alert('Failed to import album. Please verify file access.');
			}
		} catch (err) {
			console.error('Import failed:', err);
			alert('Import error occurred');
		} finally {
			importingAlbumKey = null;
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
	<!-- Page Header -->
	<div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400">
				<FolderSync class="h-4 w-4" />
				Music File Scanner
			</div>
			<h1 class="mt-1 text-2xl sm:text-3xl font-black text-white">
				Scan Existing Library & Import Tracks
			</h1>
			<p class="mt-1 text-sm text-neutral-400 max-w-2xl">
				Scan your local audio files (FLAC, MP3, etc.). Track Vault reads embedded metadata and <strong class="text-neutral-200">MusicBrainz tags</strong>, detects companion <strong class="text-neutral-200">.lrc lyrics</strong>, and lets you choose exactly which songs to add.
			</p>
		</div>

		<!-- Rescan Controls -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={rescan}
				disabled={isScanning}
				class="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 disabled:opacity-50"
			>
				<FolderSync class="h-4 w-4 {isScanning ? 'animate-spin' : ''}" />
				<span>{isScanning ? 'Scanning Files...' : 'Rescan Library'}</span>
			</button>
		</div>
	</div>

	<!-- Library Path Configuration Box -->
	<div class="mb-8 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5">
		<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
			<div class="flex items-center gap-3 min-w-0 flex-1">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-purple-400">
					<Folder class="h-5 w-5" />
				</div>
				<div class="min-w-0 flex-1">
					<label class="block text-xs font-semibold text-neutral-300">
						Server Music Directory Path
					</label>
					<input
						type="text"
						bind:value={libraryPathInput}
						placeholder="/music or /home/user/Music"
						class="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>
			</div>

			<div class="text-xs text-neutral-400 sm:text-right shrink-0">
				{#if dirExists}
					<span class="inline-flex items-center gap-1 text-emerald-400 font-semibold">
						<CheckCircle2 class="h-3.5 w-3.5" />
						Directory Connected
					</span>
					<p class="text-[11px] text-neutral-500 mt-0.5">{totalFiles} audio files discovered</p>
				{:else}
					<span class="inline-flex items-center gap-1 text-amber-400 font-semibold">
						<AlertTriangle class="h-3.5 w-3.5" />
						Directory not found
					</span>
					<p class="text-[11px] text-neutral-500 mt-0.5">Mount your music folder in Docker or set MUSIC_DIR</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Scanned Albums List -->
	{#if scannedAlbums.length > 0}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold uppercase tracking-wider text-neutral-400">
					Discovered Albums ({scannedAlbums.length})
				</h2>
				<span class="text-xs text-neutral-500">
					Expand an album to select or unselect individual songs before importing
				</span>
			</div>

			{#each scannedAlbums as album (album.album_key)}
				{@const isExpanded = !!expandedAlbums[album.album_key]}
				{@const selectedCount = album.tracks.filter((t) => t.selected).length}
				{@const isImporting = importingAlbumKey === album.album_key}

				<div class="rounded-2xl border border-neutral-800 bg-neutral-900/50 shadow-md transition hover:border-neutral-700 {album.already_in_vault ? 'opacity-85' : ''}">
					<!-- Album Card Header -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
						<div class="flex items-center gap-4 min-w-0 flex-1">
							<!-- Checkbox for entire album -->
							<input
								type="checkbox"
								checked={album.selected}
								onchange={() => toggleAlbumSelected(album)}
								disabled={album.already_in_vault}
								class="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-purple-600 focus:ring-purple-500"
								title="Select all tracks in this album"
							/>

							<!-- Cover Art / Thumbnail -->
							<div class="relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-950 border border-neutral-800">
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
									<div class="flex h-full w-full items-center justify-center text-neutral-600">
										<Disc class="h-8 w-8 opacity-40" />
									</div>
								{/if}
							</div>

							<!-- Album & Artist Title -->
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="truncate text-base font-bold text-white" title={album.title}>
										{album.title}
									</h3>

									{#if album.already_in_vault}
										<span class="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-700/60">
											<Check class="h-3 w-3" />
											In Vault
										</span>
									{/if}

									{#if album.musicbrainz_id}
										<a
											href="https://musicbrainz.org/release/{album.musicbrainz_id}"
											target="_blank"
											rel="noreferrer"
											class="inline-flex items-center gap-1 rounded bg-purple-950/60 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-700/50 hover:text-white"
											title="MusicBrainz Album ID detected in song tags"
										>
											<Sparkles class="h-3 w-3" />
											MBID: {album.musicbrainz_id.substring(0, 8)}...
											<ExternalLink class="h-2.5 w-2.5" />
										</a>
									{/if}
								</div>

								<p class="truncate text-xs font-medium text-neutral-300 mt-0.5">
									{album.artist}
								</p>

								<div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
									<span>{album.year || 'Unknown Year'}</span>
									<span>•</span>
									<span class="font-medium text-purple-400">{selectedCount} of {album.track_count} songs selected</span>
									<span>•</span>
									<span class="truncate font-mono text-[10px] text-neutral-500" title={album.folder_path}>
										{album.folder_path}
									</span>
								</div>
							</div>
						</div>

						<!-- Action Controls -->
						<div class="flex items-center gap-2 sm:justify-end">
							<button
								type="button"
								onclick={() => toggleExpand(album.album_key)}
								class="flex items-center gap-1.5 rounded-xl bg-neutral-800/80 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 hover:text-white transition"
							>
								<span>Choose Songs ({selectedCount})</span>
								{#if isExpanded}
									<ChevronUp class="h-4 w-4" />
								{:else}
									<ChevronDown class="h-4 w-4" />
								{/if}
							</button>

							{#if album.already_in_vault}
								{#if importedAlbumIds[album.album_key]}
									<a
										href="/album/{importedAlbumIds[album.album_key]}"
										class="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow"
									>
										<span>View Album</span>
										<ArrowRight class="h-3.5 w-3.5" />
									</a>
								{:else}
									<span class="rounded-xl bg-neutral-800 px-3 py-2 text-xs text-neutral-500">
										Already Tracked
									</span>
								{/if}
							{:else}
								<button
									type="button"
									onclick={() => importSingleAlbum(album)}
									disabled={isImporting || selectedCount === 0}
									class="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/30 transition disabled:opacity-50"
								>
									<Check class="h-3.5 w-3.5" />
									<span>{isImporting ? 'Importing...' : 'Add Selected'}</span>
								</button>
							{/if}
						</div>
					</div>

					<!-- Expandable Tracklist Table -->
					{#if isExpanded}
						<div class="border-t border-neutral-800/80 bg-neutral-950/70 p-4">
							<div class="mb-3 flex items-center justify-between text-xs">
								<div class="flex items-center gap-2">
									<span class="font-semibold text-neutral-300">Choose Songs to Track:</span>
									<button
										type="button"
										onclick={() => selectAllTracks(album, true)}
										class="text-purple-400 hover:underline font-medium"
									>
										Select All
									</button>
									<span>•</span>
									<button
										type="button"
										onclick={() => selectAllTracks(album, false)}
										class="text-neutral-400 hover:underline font-medium"
									>
										Deselect All
									</button>
								</div>

								<span class="text-neutral-500 text-[11px]">
									Auto-detected from tags & folder files
								</span>
							</div>

							<div class="divide-y divide-neutral-800/50 rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950">
								{#each album.tracks as track}
									<div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-2.5 text-xs transition hover:bg-neutral-900/60 {track.selected ? '' : 'opacity-50 bg-neutral-900/10'}">
										<!-- Track Selection Checkbox & Info -->
										<div class="flex items-center gap-3 min-w-0 flex-1">
											<input
												type="checkbox"
												checked={track.selected}
												onchange={() => toggleTrackSelected(album, track)}
												class="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-purple-600 focus:ring-purple-500"
											/>

											<span class="w-6 text-right font-mono text-neutral-500 text-[11px]">
												{track.track_number}
											</span>

											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-2">
													<span class="truncate font-semibold text-neutral-100" title={track.title}>
														{track.title}
													</span>
													{#if track.musicbrainz_track_id}
														<span class="rounded bg-neutral-800/80 px-1 text-[9px] font-mono text-neutral-400" title="MB Track ID">
															MB
														</span>
													{/if}
												</div>

												<div class="flex items-center gap-2 text-[11px] text-neutral-400">
													{#if track.artist !== album.artist}
														<span class="truncate text-neutral-400">{track.artist}</span>
														<span>•</span>
													{/if}
													<span class="font-mono text-neutral-500">{formatDuration(track.duration_ms)}</span>
													{#if track.bitrate_kbps}
														<span>•</span>
														<span class="text-neutral-500">{track.bitrate_kbps} kbps</span>
													{/if}
												</div>
											</div>
										</div>

										<!-- Badges & Overrides -->
										<div class="flex flex-wrap items-center gap-2">
											<!-- Format Dropdown -->
											<select
												bind:value={track.format}
												class="rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase {getFormatBadgeClass(track.format)}"
												title="Detected audio format (click to change)"
											>
												{#each FORMAT_OPTIONS as opt}
													<option value={opt.value} class="bg-neutral-900 text-neutral-200">
														{opt.label}
													</option>
												{/each}
											</select>

											<!-- Quality Dropdown -->
											<select
												bind:value={track.quality_rating}
												class="rounded-lg border px-2 py-0.5 text-[11px] font-medium {QUALITY_OPTIONS.find(q => q.value === track.quality_rating)?.color}"
												title="Audio quality"
											>
												{#each QUALITY_OPTIONS as q}
													<option value={q.value} class="bg-neutral-900 text-neutral-200">
														{q.label}
													</option>
												{/each}
											</select>

											<!-- Censorship Dropdown -->
											<select
												bind:value={track.censorship}
												class="rounded-lg border px-2 py-0.5 text-[11px] font-medium {CENSORSHIP_OPTIONS.find(c => c.value === track.censorship)?.color}"
												title="Censorship status"
											>
												{#each CENSORSHIP_OPTIONS as c}
													<option value={c.value} class="bg-neutral-900 text-neutral-200">
														{c.label}
													</option>
												{/each}
											</select>

											<!-- Lyrics Dropdown -->
											<select
												bind:value={track.lyrics}
												class="rounded-lg border px-2 py-0.5 text-[11px] font-medium {LYRICS_OPTIONS.find(l => l.value === track.lyrics)?.color}"
												title="Lyrics status (.lrc file detected or missing)"
											>
												{#each LYRICS_OPTIONS as l}
													<option value={l.value} class="bg-neutral-900 text-neutral-200">
														{l.label}
													</option>
												{/each}
											</select>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<!-- Empty State / Setup Instructions -->
		<div class="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
			<FolderSync class="mx-auto h-12 w-12 text-purple-400 mb-3 opacity-60" />
			<h3 class="text-lg font-bold text-white">No Audio Files Found in Library Path</h3>
			<p class="mt-1 text-xs text-neutral-400 max-w-md mx-auto">
				We couldn't find audio files (.flac, .mp3, .m4a, etc.) at <code class="text-purple-300 font-mono">{libraryPathInput}</code>.
			</p>

			<div class="mt-6 max-w-lg mx-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-left text-xs text-neutral-400 space-y-2">
				<p class="font-bold text-neutral-200">How to mount your music library in Docker:</p>
				<p>1. Open <code class="text-purple-300 font-mono">docker-compose.yml</code></p>
				<p>2. Add your server music folder under volumes:</p>
				<pre class="bg-neutral-900 p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
volumes:
  - ./data:/app/data
  - /media/Music:/music:ro</pre>
				<p>3. Run <code class="text-purple-300 font-mono">docker-compose up -d</code> and your entire music collection will appear here instantly!</p>
			</div>
		</div>
	{/if}
</div>
