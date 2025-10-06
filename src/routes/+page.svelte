<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import clsx from 'clsx';
	import { labs as labsStore, recordLabEvent, normalizeLab } from '$lib/stores.js';
	import { preferences } from '$lib/preferencesStore.js';
	import { filterForExamPrep, renderMarkdown } from '$lib/markdown.js';
	import {
		Bird,
		Bot,
		ChevronDown,
		Computer,
		ExternalLink,
		GripVertical,
		NotepadText,
		Plus,
		PlusCircle,
		Save,
		Search,
		ShieldCheck,
		Trash2,
		X,
		Edit2
	} from 'lucide-svelte';

	import htbData from '$lib/data/htb_labs.json';
	import pgPracticeData from '$lib/data/pg_practice_labs.json';
	import oscpData from '$lib/data/oscp_labs.json';

	const MAX_NOTE_LINES = 50;
	const MAX_NOTE_CHARS = 4000;
	const STATUS_META = {
		owned: {
			label: 'Owned',
			badge: 'border border-violet-400/60 bg-violet-500/15 text-violet-200',
			pill: 'border border-violet-400/70 bg-violet-500/20 text-violet-100',
			icon: '✅'
		},
		in_progress: {
			label: 'In Progress',
			badge: 'border border-amber-400/60 bg-amber-500/15 text-amber-200',
			pill: 'border border-amber-400/70 bg-amber-500/20 text-amber-100',
			icon: '⏳'
		},
		not_started: {
			label: 'Not Started',
			badge: 'border border-slate-500/50 bg-slate-800/70 text-slate-300',
			pill: 'border border-slate-600/60 bg-slate-900/70 text-slate-300',
			icon: '❌'
		}
	};
	const STATUS_SEQUENCE = ['not_started', 'in_progress', 'owned'];
	const STATUS_ORDER = ['not_started', 'in_progress', 'owned'];
	const STATUS_BUTTONS = STATUS_SEQUENCE.map((key) => ({ key, meta: STATUS_META[key] })).filter(
		(item) => item.meta
	);

	const initialData = { htb: htbData, pg: pgPracticeData, oscp: oscpData };
	const osOptions = ['Linux', 'Windows'];

	let activeListKey = 'htb';
	let activeCategoryName = '';
	let searchTerm = '';

	$: normalizedSearchTerm = searchTerm.trim().toLowerCase();

	let showAddForm = false;
	let newLabName = '';
	let newLabDifficulty = 'Easy';
	let newLabOs = osOptions[0] || '';
	let newLabServices = '';
	let newLabTags = '';
	let newLabCves = '';
	let newLabAvatar = '';

	let showNoteModal = false;
	let activeNoteLab = null;
	let newIndividualNoteContent = '';
	let editingIndividualNoteId = null;
	let editingIndividualNoteContent = '';

	$: activeData = initialData?.[activeListKey];

	onMount(() => {
		let needsInitialization = get(labsStore).length === 0;

		if (!needsInitialization) {
			const sampleLab = get(labsStore)[0];
			if (!sampleLab || !sampleLab.status || !Array.isArray(sampleLab.notes)) {
				needsInitialization = true;
			}
		}

		if (needsInitialization) {
			const seedLabs = [];
			Object.entries(initialData).forEach(([sourceKey, data]) => {
				data.categories.forEach((category) => {
					category.labs.forEach((lab) => {
						seedLabs.push(
							normalizeLab({
								...lab,
								id: `${sourceKey}-${lab.name.toLowerCase().replace(/[\s()]/g, '-')}-${crypto.randomUUID()}`,
								source: sourceKey,
								category: category.name,
								avatar: lab.avatar || '',
								status: 'not_started',
								completed: false,
								completedAt: null,
								startedAt: null,
								notes: [],
								history: []
							})
						);
					});
				});
			});
			labsStore.set(seedLabs);
		}

		if (initialData?.[activeListKey]?.categories?.length > 0) {
			activeCategoryName = initialData[activeListKey].categories[0].name;
		}
	});

	$: {
		if (activeData?.categories?.length) {
			const exists = activeData.categories.some((category) => category.name === activeCategoryName);
			if (!exists) {
				activeCategoryName = activeData.categories[0].name;
			}
		}
	}

	const statusRank = (status) => STATUS_ORDER.indexOf(status ?? 'not_started');

	const matchesSearch = (lab) => {
		if (!normalizedSearchTerm) return true;

		const fields = [
			lab.name,
			lab.os,
			lab.difficulty,
			...(lab.services || []),
			...(lab.cves || []),
			...(lab.tags || []),
			(lab.notes || [])
				.map((note) => note?.content || '')
				.filter(Boolean)
				.join(' ')
		].filter(Boolean);

		return fields.some((field) => field.toLowerCase().includes(normalizedSearchTerm));
	};

	$: labsMatchingSearch = $labsStore.filter(matchesSearch);

	const toMillis = (timestamp) => {
		if (!timestamp) return 0;
		const date = new Date(timestamp);
		return Number.isNaN(date.getTime()) ? 0 : date.getTime();
	};

	const getLatestActivityTimestamp = (lab) => {
		const timestamps = [];

		if (lab?.updatedAt) timestamps.push(lab.updatedAt);
		if (lab?.history?.length) {
			lab.history.forEach((event) => {
				if (event?.timestamp) {
					timestamps.push(event.timestamp);
				}
			});
		}
		if (lab?.completedAt) timestamps.push(lab.completedAt);
		if (lab?.startedAt) timestamps.push(lab.startedAt);

		return timestamps.reduce((latest, current) => {
			if (!current) return latest;
			if (!latest || toMillis(current) > toMillis(latest)) {
				return current;
			}
			return latest;
		}, null);
	};

	const getSourceLabel = (lab) => initialData?.[lab.source]?.listName || lab.source || 'Lab';

	$: currentlyPlayingLabs = labsMatchingSearch
		.filter((lab) => lab.status === 'in_progress')
		.sort(
			(a, b) => toMillis(getLatestActivityTimestamp(b)) - toMillis(getLatestActivityTimestamp(a))
		)
		.slice(0, 1);

	$: lastPlayedLab =
		(
			labsMatchingSearch
				.filter((lab) => lab.status === 'owned')
				.map((lab) => ({ lab, timestamp: getLatestActivityTimestamp(lab) }))
				.filter((item) => item.timestamp)
				.sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))?.[0] || null
		)?.lab || null;

	$: lastPlayedTimestamp = lastPlayedLab ? getLatestActivityTimestamp(lastPlayedLab) : null;

	$: highlightedSectionLabel = [
		currentlyPlayingLabs.length > 0 ? 'currentlyPlayingHeading' : null,
		lastPlayedLab ? 'lastPlayedHeading' : null
	]
		.filter(Boolean)
		.join(' ');

	$: labsToShow = labsMatchingSearch
		.filter((lab) => lab.source === activeListKey && lab.category === activeCategoryName)
		.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));

	$: overallStatus = $labsStore.reduce(
		(acc, lab) => {
			acc[lab.status || 'not_started'] += 1;
			return acc;
		},
		{ owned: 0, in_progress: 0, not_started: 0 }
	);

	$: ownedByCategory = (activeData?.categories || []).map((category) => {
		const labsInCategory = $labsStore.filter(
			(lab) => lab.source === activeListKey && lab.category === category.name
		);
		const owned = labsInCategory.filter((lab) => lab.status === 'owned').length;
		const inProgress = labsInCategory.filter((lab) => lab.status === 'in_progress').length;
		const totalReference = Math.max(labsInCategory.length, category.labs?.length || 0);
		const notStarted = Math.max(totalReference - owned - inProgress, 0);
		return {
			name: category.name,
			total: totalReference,
			owned,
			inProgress,
			notStarted
		};
	});

	function parseListInput(input) {
		return input
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function handleAddLab() {
		if (!newLabName.trim()) {
			alert('Lab Name is required.');
			return;
		}

		const timestamp = new Date().toISOString();
		const newLab = normalizeLab({
			name: newLabName.trim(),
			difficulty: newLabDifficulty,
			os: newLabOs.trim() || 'Unknown',
			avatar: newLabAvatar.trim(),
			id: `${activeListKey}-${newLabName
				.trim()
				.toLowerCase()
				.replace(/[\s()]/g, '-')}-${crypto.randomUUID()}`,
			source: activeListKey,
			category: activeCategoryName,
			status: 'not_started',
			completed: false,
			completedAt: null,
			startedAt: null,
			notes: [],
			services: parseListInput(newLabServices),
			cves: parseListInput(newLabCves),
			tags: parseListInput(newLabTags),
			history: [
				{
					id: crypto.randomUUID(),
					type: 'status',
					status: 'not_started',
					timestamp,
					summary: 'Lab created'
				}
			]
		});

		labsStore.update((current) => [newLab, ...current]);

		newLabName = '';
		newLabDifficulty = 'Easy';
		newLabOs = osOptions[0] || '';
		newLabServices = '';
		newLabTags = '';
		newLabCves = '';
		newLabAvatar = '';
		showAddForm = false;
	}

	function setLabStatus(lab, status) {
		const timestamp = new Date().toISOString();
		labsStore.update((currentLabs) =>
			currentLabs.map((item) => {
				if (item.id !== lab.id) return item;
				let updated = {
					...item,
					status,
					completed: status === 'owned'
				};

				if (status === 'owned') {
					updated = {
						...updated,
						completedAt: timestamp,
						startedAt: updated.startedAt || timestamp
					};
				} else if (status === 'in_progress') {
					updated = {
						...updated,
						startedAt: updated.startedAt || timestamp,
						completedAt: null
					};
				} else {
					updated = {
						...updated,
						startedAt: null,
						completedAt: null
					};
				}

				return recordLabEvent(updated, {
					type: 'status',
					status,
					timestamp,
					summary: `${item.name} → ${STATUS_META[status].label}`
				});
			})
		);

		if (showNoteModal) {
			activeNoteLab = get(labsStore).find((item) => item.id === lab.id) || null;
		}
	}

	function openNoteModal(lab) {
		activeNoteLab = get(labsStore).find((item) => item.id === lab.id) || lab;
		newIndividualNoteContent = '';
		editingIndividualNoteId = null;
		editingIndividualNoteContent = '';
		showNoteModal = true;
	}

	function closeNoteModal() {
		showNoteModal = false;
		activeNoteLab = null;
		newIndividualNoteContent = '';
		editingIndividualNoteId = null;
		editingIndividualNoteContent = '';
	}

	function addIndividualNote() {
		if (!newIndividualNoteContent.trim()) return;

		const timestamp = new Date().toISOString();
		const newNote = {
			id: crypto.randomUUID(),
			content: newIndividualNoteContent.trim(),
			timestamp
		};

		labsStore.update((current) =>
			current.map((lab) => {
				if (lab.id !== activeNoteLab.id) return lab;
				const updated = {
					...lab,
					notes: [...(lab.notes || []), newNote]
				};
				return recordLabEvent(updated, {
					type: 'note',
					noteId: newNote.id,
					timestamp,
					summary: 'Added note entry'
				});
			})
		);

		activeNoteLab = get(labsStore).find((lab) => lab.id === activeNoteLab.id) || null;
		newIndividualNoteContent = '';
	}

	function startEditIndividualNote(note) {
		editingIndividualNoteId = note.id;
		editingIndividualNoteContent = note.content;
	}

	function saveIndividualNote() {
		if (!editingIndividualNoteId || !editingIndividualNoteContent.trim()) return;

		const timestamp = new Date().toISOString();

		labsStore.update((current) =>
			current.map((lab) => {
				if (lab.id !== activeNoteLab.id) return lab;
				const updated = {
					...lab,
					notes: (lab.notes || []).map((note) =>
						note.id === editingIndividualNoteId
							? { ...note, content: editingIndividualNoteContent.trim(), timestamp }
							: note
					)
				};
				return recordLabEvent(updated, {
					type: 'note_edit',
					noteId: editingIndividualNoteId,
					timestamp,
					summary: 'Edited note entry'
				});
			})
		);

		activeNoteLab = get(labsStore).find((lab) => lab.id === activeNoteLab.id) || null;
		cancelEditIndividualNote();
	}

	function cancelEditIndividualNote() {
		editingIndividualNoteId = null;
		editingIndividualNoteContent = '';
	}

	function deleteIndividualNote(noteId) {
		if (!confirm('Delete this note entry?')) return;

		labsStore.update((current) =>
			current.map((lab) => {
				if (lab.id !== activeNoteLab.id) return lab;
				const updated = {
					...lab,
					notes: (lab.notes || []).filter((note) => note.id !== noteId)
				};
				return recordLabEvent(updated, {
					type: 'note_delete',
					noteId,
					timestamp: new Date().toISOString(),
					summary: 'Deleted note entry'
				});
			})
		);

		activeNoteLab = get(labsStore).find((lab) => lab.id === activeNoteLab.id) || null;
	}

	function checkNewNoteContent() {
		const lines = newIndividualNoteContent.split('\n').length;
		if (lines > MAX_NOTE_LINES) {
			newIndividualNoteContent = newIndividualNoteContent
				.split('\n')
				.slice(0, MAX_NOTE_LINES)
				.join('\n');
		}
		if (newIndividualNoteContent.length > MAX_NOTE_CHARS) {
			newIndividualNoteContent = newIndividualNoteContent.substring(0, MAX_NOTE_CHARS);
		}
	}

	function checkEditingNoteContent() {
		const lines = editingIndividualNoteContent.split('\n').length;
		if (lines > MAX_NOTE_LINES) {
			editingIndividualNoteContent = editingIndividualNoteContent
				.split('\n')
				.slice(0, MAX_NOTE_LINES)
				.join('\n');
		}
		if (editingIndividualNoteContent.length > MAX_NOTE_CHARS) {
			editingIndividualNoteContent = editingIndividualNoteContent.substring(0, MAX_NOTE_CHARS);
		}
	}

	const buildLabUrl = (lab) => {
		if (lab.source === 'htb') {
			return `https://www.hackthebox.com/machines/${encodeURIComponent(lab.name)}`;
		}
		if (lab.source === 'pg') {
			return 'https://portal.offensive-security.com/proving-grounds';
		}
		if (lab.source === 'oscp') {
			return 'https://www.offsec.com/courses/pen-200/';
		}
		return '#';
	};

	const labAvatar = (lab) => {
		if (lab.avatar) return lab.avatar;
		if (lab.os?.toLowerCase().includes('linux')) return 'linux';
		if (lab.os?.toLowerCase().includes('windows')) return 'windows';
		if (lab.os?.toLowerCase().includes('directory')) return 'ad';
		return 'generic';
	};

	const formatTimestamp = (timestamp) => {
		if (!timestamp) return '—';
		const date = new Date(timestamp);
		return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	};

	const renderNote = (note) => {
		const source = $preferences.examPrepMode ? filterForExamPrep(note.content) : note.content;
		return renderMarkdown(source);
	};
</script>

<svelte:head>
	<title>Hack Ascent HQ Dashboard</title>
</svelte:head>

<section class="space-y-6">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex-1">
			<label
				for="list-select"
				class="mb-2 block text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase"
				>Target List</label
			>
			<div class="relative">
				<select
					id="list-select"
					bind:value={activeListKey}
					class="input-elevated w-full appearance-none px-4 py-2 pr-10 font-semibold md:w-64"
				>
					{#each Object.entries(initialData) as [key, data] (key)}
						<option value={key}>{data.listName}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400"
				>
					<ChevronDown size={20} />
				</div>
			</div>
		</div>

		<div class="flex-1">
			<label
				class="mb-2 block text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase"
				for="search"
			>
				Search Labs / CVE / Service
			</label>
			<div class="relative">
				<Search class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
				<input
					id="search"
					type="search"
					placeholder="e.g. Active Directory, CVE-2021-42278, WinRM"
					bind:value={searchTerm}
					class="input-elevated w-full py-2 pr-4 pl-11"
				/>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
		<aside class="space-y-6">
			<div class="glass-panel space-y-5 p-5">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-bold text-slate-100">Categories</h2>
					<button
						on:click={() => (showAddForm = !showAddForm)}
						class="rounded-full border border-violet-500/30 bg-violet-500/10 p-2 text-violet-300 transition-all hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-violet-200"
						aria-label="Add lab"
					>
						<PlusCircle size={22} />
					</button>
				</div>

				{#if showAddForm}
					<div class="space-y-4 border-t border-white/10 pt-4">
						<h3 class="text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">
							Quick Add Lab
						</h3>
						<form on:submit|preventDefault={handleAddLab} class="space-y-4">
							<div class="space-y-2">
								<label
									for="new-lab-name"
									class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
									>Lab Name</label
								>
								<input
									id="new-lab-name"
									type="text"
									placeholder={`Add to "${activeCategoryName}"...`}
									bind:value={newLabName}
									required
									class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
								/>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-2">
									<label
										for="new-lab-difficulty"
										class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
										>Difficulty</label
									>
									<select
										id="new-lab-difficulty"
										bind:value={newLabDifficulty}
										class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
									>
										<option value="Easy">Easy</option>
										<option value="Medium">Medium</option>
										<option value="Intermediate">Intermediate</option>
										<option value="Hard">Hard</option>
									</select>
								</div>
								<div class="space-y-2">
									<label
										for="new-lab-os"
										class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
										>OS</label
									>
									<select
										id="new-lab-os"
										bind:value={newLabOs}
										class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
									>
										{#each osOptions as option (option)}
											<option value={option}>{option}</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="space-y-2">
								<label
									for="new-lab-services"
									class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
									>Services (comma separated)</label
								>
								<input
									id="new-lab-services"
									type="text"
									bind:value={newLabServices}
									placeholder="http, smb, winrm"
									class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
								/>
							</div>
							<div class="space-y-2">
								<label
									for="new-lab-cves"
									class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
									>CVEs (comma separated)</label
								>
								<input
									id="new-lab-cves"
									type="text"
									bind:value={newLabCves}
									placeholder="CVE-2023-xxxx"
									class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
								/>
							</div>
							<div class="space-y-2">
								<label
									for="new-lab-tags"
									class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
									>Tags (comma separated)</label
								>
								<input
									id="new-lab-tags"
									type="text"
									bind:value={newLabTags}
									placeholder="pivoting, bloodhound"
									class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
								/>
							</div>
							<div class="space-y-2">
								<label
									for="new-lab-avatar"
									class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase"
									>Avatar URL (optional)</label
								>
								<input
									id="new-lab-avatar"
									type="url"
									bind:value={newLabAvatar}
									placeholder="https://..."
									class="input-elevated w-full rounded-lg px-3 py-2 text-sm"
								/>
							</div>
							<button
								type="submit"
								class="w-full rounded-lg border border-violet-500/50 bg-violet-500/20 py-2 font-bold text-violet-100 shadow-[0_12px_30px_rgba(168,85,247,0.35)] transition-colors hover:border-violet-400/60 hover:bg-violet-500/30"
							>
								Add Lab
							</button>
						</form>
					</div>
				{/if}

				<nav class="flex flex-col gap-2">
					{#each activeData?.categories || [] as category (category.name)}
						<button
							on:click={() => (activeCategoryName = category.name)}
							class={clsx(
								'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors',
								activeCategoryName === category.name
									? 'border border-violet-400/60 bg-[rgba(168,85,247,0.18)] text-violet-200 shadow-[0_18px_45px_rgba(168,85,247,0.4)]'
									: 'border border-transparent text-slate-300 hover:border-violet-400/30 hover:bg-[rgba(19,8,48,0.6)]'
							)}
						>
							<span>{category.name}</span>
							<span class="pill-counter">
								{$labsStore.filter(
									(lab) => lab.source === activeListKey && lab.category === category.name
								).length}
							</span>
						</button>
					{/each}
				</nav>
			</div>

			<div class="glass-panel space-y-4 p-5">
				<h2 class="flex items-center gap-2 text-lg font-bold text-slate-100">
					<ShieldCheck size={18} /> Scoreboard
				</h2>
				<div class="grid grid-cols-3 gap-3 text-center">
					{#each Object.entries(overallStatus) as [status, count] (status)}
						<div class="glass-surface rounded-xl p-3">
							<p class="mb-1 text-xl" aria-hidden="true">
								{STATUS_META[status].icon}
							</p>
							<span class="sr-only">{STATUS_META[status].label}</span>
							<p class="text-2xl font-bold text-slate-100">{count}</p>
						</div>
					{/each}
				</div>
				<div class="space-y-3">
					<h3 class="text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">
						Owned by Category
					</h3>
					<div class="space-y-3">
						{#each ownedByCategory as category (category.name)}
							<div>
								<div class="mb-1 flex justify-between text-xs text-slate-400">
									<span>{category.name}</span>
									<span>{category.owned}/{category.total}</span>
								</div>
								<div
									class="h-2 overflow-hidden rounded-full border border-white/10 bg-[rgba(9,19,38,0.72)]"
								>
									<div
										class="h-full bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-400 transition-all"
										style={`width: ${category.total === 0 ? 0 : Math.min(100, (category.owned / category.total) * 100)}%;`}
									></div>
								</div>
								<p class="sr-only">
									In progress: {category.inProgress}. Not started: {category.notStarted}.
								</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</aside>

		<div class="space-y-5">
			{#if currentlyPlayingLabs.length > 0 || lastPlayedLab}
				<section class="space-y-4">
					<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						{#if currentlyPlayingLabs.length > 0}
							<h3
								id="currentlyPlayingHeading"
								class="text-sm font-semibold tracking-wide text-violet-500 uppercase"
							>
								Currently Playing
							</h3>
						{/if}
						{#if lastPlayedLab}
							<h3
								id="lastPlayedHeading"
								class="text-sm font-semibold tracking-wide text-indigo-500 uppercase md:text-right"
							>
								Last Played
							</h3>
						{/if}
					</div>

					<div
						class="grid grid-cols-1 gap-4 xl:grid-cols-2"
						aria-labelledby={highlightedSectionLabel || undefined}
					>
						{#if currentlyPlayingLabs.length > 0}
							{#each currentlyPlayingLabs as lab (lab.id)}
								<article
									class="flex flex-col gap-4 rounded-2xl border border-violet-400/60 bg-gradient-to-br from-violet-500/15 via-slate-900/70 to-slate-950/80 p-5 shadow-[0_35px_80px_rgba(168,85,247,0.35)] transition-shadow hover:shadow-[0_45px_100px_rgba(168,85,247,0.45)]"
								>
									<div class="flex items-start justify-between gap-4">
										<div class="space-y-1">
											<p class="text-xs font-semibold tracking-wide text-violet-500 uppercase">
												In Progress Spotlight
											</p>
											<h3 class="text-xl font-bold text-slate-100">
												{lab.name}
											</h3>
											<p class="text-xs text-slate-300/80">
												{getSourceLabel(lab)} • {lab.category}
											</p>
										</div>
										<span
											class={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[lab.status].badge}`}
										>
											{STATUS_META[lab.status].icon}
											{STATUS_META[lab.status].label}
										</span>
									</div>
									<div class="flex flex-wrap gap-2 text-xs text-slate-300/80">
										{#if lab.difficulty}
											<span
												class="rounded-full border border-violet-400/60 bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-200"
											>
												{lab.difficulty}
											</span>
										{/if}
										{#each lab.services || [] as service (service)}
											<span
												class="rounded-full border border-white/15 bg-[rgba(19,8,48,0.68)] px-2 py-0.5"
											>
												{service}
											</span>
										{/each}
										{#each lab.cves || [] as cve (cve)}
											<span
												class="rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 text-violet-200"
											>
												{cve}
											</span>
										{/each}
									</div>
									<div
										class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300/70"
									>
										<span>Last update: {formatTimestamp(getLatestActivityTimestamp(lab))}</span>
										<div class="flex items-center gap-2">
											<button
												on:click={() => openNoteModal(lab)}
												class="inline-flex items-center gap-2 rounded-lg border border-violet-400/60 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
											>
												Notes
											</button>
											{#each STATUS_BUTTONS as { key: statusKey, meta } (statusKey)}
												<button
													class={clsx(
														'rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
														lab.status === statusKey
															? `${meta.pill} border-transparent`
															: 'border-white/15 bg-[rgba(19,8,48,0.6)] text-slate-300 hover:border-violet-400/55 hover:bg-[rgba(168,85,247,0.15)] hover:text-violet-200'
													)}
													on:click={() => setLabStatus(lab, statusKey)}
													type="button"
												>
													{meta.icon}
												</button>
											{/each}
										</div>
									</div>
								</article>
							{/each}
						{/if}

						{#if lastPlayedLab}
							<article
								aria-labelledby="lastPlayedHeading"
								class="flex flex-col gap-4 rounded-2xl border border-indigo-400/60 bg-gradient-to-br from-indigo-500/15 via-slate-900/70 to-slate-950/80 p-5 shadow-[0_35px_80px_rgba(192,132,252,0.35)] transition-shadow hover:shadow-[0_45px_100px_rgba(192,132,252,0.45)]"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="space-y-1">
										<p class="text-xs font-semibold tracking-wide text-indigo-500 uppercase">
											Highlight
										</p>
										<h3 class="text-xl font-bold text-slate-100">
											{lastPlayedLab.name}
										</h3>
										<p class="text-xs text-slate-300/80">
											{getSourceLabel(lastPlayedLab)} • {lastPlayedLab.category}
										</p>
									</div>
									<span
										class={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[lastPlayedLab.status].badge}`}
									>
										{STATUS_META[lastPlayedLab.status].icon}
										{STATUS_META[lastPlayedLab.status].label}
									</span>
								</div>
								<div class="flex flex-wrap gap-2 text-xs text-slate-300/80">
									{#if lastPlayedLab.difficulty}
										<span
											class="rounded-full border border-indigo-400/60 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-200"
										>
											{lastPlayedLab.difficulty}
										</span>
									{/if}
									{#each lastPlayedLab.services || [] as service (service)}
										<span
											class="rounded-full border border-white/15 bg-[rgba(19,8,48,0.68)] px-2 py-0.5"
											>{service}</span
										>
									{/each}
									{#each lastPlayedLab.cves || [] as cve (cve)}
										<span
											class="rounded-full border border-indigo-400/50 bg-indigo-500/10 px-2 py-0.5 text-indigo-200"
										>
											{cve}
										</span>
									{/each}
								</div>
								<div
									class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300/70"
								>
									<span>Last activity: {formatTimestamp(lastPlayedTimestamp)}</span>
									<div class="flex items-center gap-2">
										<a
											href={buildLabUrl(lastPlayedLab)}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-2 rounded-lg border border-indigo-400/60 bg-[rgba(19,8,48,0.65)] px-3 py-1 text-xs font-semibold text-indigo-200 transition-colors hover:bg-[rgba(192,132,252,0.18)]"
										>
											Open Lab
										</a>
										<button
											on:click={() => openNoteModal(lastPlayedLab)}
											class="inline-flex items-center gap-2 rounded-lg border border-indigo-400/60 bg-[rgba(19,8,48,0.65)] px-3 py-1 text-xs font-semibold text-indigo-200 transition-colors hover:bg-[rgba(192,132,252,0.18)]"
										>
											Notes
										</button>
										{#each STATUS_BUTTONS as { key: statusKey, meta } (statusKey)}
											<button
												class={clsx(
													'rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
													lastPlayedLab.status === statusKey
														? `${meta.pill} border-transparent`
														: 'border-white/15 bg-[rgba(19,8,48,0.6)] text-slate-300 hover:border-indigo-400/55 hover:bg-[rgba(192,132,252,0.16)] hover:text-indigo-200'
												)}
												on:click={() => setLabStatus(lastPlayedLab, statusKey)}
												type="button"
											>
												{meta.icon}
											</button>
										{/each}
									</div>
								</div>
							</article>
						{/if}
					</div>
				</section>
			{/if}

			<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 class="text-2xl font-bold text-slate-100">
						{activeCategoryName}
					</h2>
					<p class="text-sm text-slate-300/80">{labsToShow.length} labs matched</p>
				</div>
				<p class="text-xs text-slate-400/80 uppercase">
					✅ Owned • ⏳ In Progress • ❌ Not Started — track status and notes with markdown +
					screenshots
				</p>
			</header>

			{#if labsToShow.length === 0}
				<div
					class="glass-surface border border-dashed border-fuchsia-400/25 p-6 text-center text-slate-300"
				>
					No labs matched your search.
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{#each labsToShow as lab (lab.id)}
						<article
							class={clsx(
								'group glass-surface flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:shadow-[0_35px_100px_rgba(192,132,252,0.38)]',
								lab.status === 'owned'
									? 'border-violet-400/60 shadow-[0_35px_100px_rgba(168,85,247,0.38)]'
									: ''
							)}
						>
							<div class="flex gap-4 p-4">
								<div
									class="glass-surface flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl shadow-[0_18px_40px_rgba(7,16,38,0.5)]"
								>
									{#if labAvatar(lab) === 'linux'}
										<Bird size={42} class="text-violet-400/70" />
									{:else if labAvatar(lab) === 'windows'}
										<Computer size={42} class="text-indigo-400/70" />
									{:else if labAvatar(lab) === 'ad'}
										<Bot size={42} class="text-violet-400/70" />
									{:else if lab.avatar}
										<img
											src={lab.avatar}
											alt={`${lab.name} icon`}
											class="h-full w-full object-cover"
										/>
									{:else}
										<ShieldCheck size={36} class="text-slate-400/70" />
									{/if}
								</div>
								<div class="flex-1">
									<div class="flex items-start justify-between gap-2">
										<h3 class="text-lg leading-tight font-semibold text-slate-100">
											{lab.name}
										</h3>
										<span
											class={clsx(
												'rounded-full border px-2 py-1 text-xs font-bold',
												lab.difficulty?.toLowerCase().includes('easy')
													? 'border-violet-400/60 bg-violet-500/10 text-violet-200'
													: lab.difficulty?.toLowerCase().includes('hard')
														? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
														: 'border-amber-400/60 bg-amber-500/10 text-amber-200'
											)}
										>
											{lab.difficulty || 'N/A'}
										</span>
									</div>
									<p class="mt-1 text-sm text-slate-300/80">
										{lab.os || 'Unknown OS'}
									</p>
									<div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-300/70">
										{#each lab.services || [] as service (service)}
											<span
												class="rounded-full border border-white/15 bg-[rgba(19,8,48,0.68)] px-2 py-0.5"
												>{service}</span
											>
										{/each}
										{#each lab.cves || [] as cve (cve)}
											<span
												class="rounded-full border border-rose-400/50 bg-rose-500/10 px-2 py-0.5 text-rose-200"
												>{cve}</span
											>
										{/each}
									</div>
								</div>
							</div>
							<div class="flex flex-1 flex-col gap-3 px-4 pb-4">
								<div class="flex items-center justify-between text-xs text-slate-300/70">
									<span
										class={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${STATUS_META[lab.status].badge}`}
									>
										{STATUS_META[lab.status].icon}
										{STATUS_META[lab.status].label}
									</span>
									<span
										>Updated: {formatTimestamp(
											lab.history?.at?.(-1)?.timestamp || lab.completedAt || lab.startedAt
										)}</span
									>
								</div>
								<div class="mt-auto flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<a
											href={buildLabUrl(lab)}
											target="_blank"
											rel="noopener noreferrer"
											class="rounded-full border border-indigo-400/30 bg-[rgba(19,8,48,0.65)] p-2 text-slate-200 transition-colors hover:border-indigo-400/55 hover:bg-[rgba(192,132,252,0.18)] hover:text-indigo-200"
											title="Open lab portal"
										>
											<ExternalLink size={18} />
										</a>
										<button
											on:click={() => openNoteModal(lab)}
											class={clsx(
												'rounded-full border p-2 transition-colors',
												(lab.notes || []).length > 0
													? 'border-violet-400/60 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
													: 'border-white/15 bg-[rgba(19,8,48,0.6)] text-slate-300 hover:border-violet-400/55 hover:bg-[rgba(168,85,247,0.14)] hover:text-violet-200'
											)}
											title={(lab.notes || []).length > 0 ? 'Manage notes' : 'Add notes'}
										>
											<NotepadText size={18} />
										</button>
										<a
											href={`/writeups/${lab.id}`}
											class="rounded-full border border-violet-400/30 bg-[rgba(19,8,48,0.65)] p-2 text-slate-200 transition-colors hover:border-violet-400/55 hover:bg-[rgba(168,85,247,0.16)] hover:text-violet-200"
											title="Open blog mode"
										>
											<ShieldCheck size={18} />
										</a>
									</div>
									<div class="flex items-center gap-2">
										{#each STATUS_BUTTONS as { key: statusKey, meta } (statusKey)}
											<button
												class={clsx(
													'rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
													lab.status === statusKey
														? `${meta.pill} border-transparent`
														: 'border-white/15 bg-[rgba(19,8,48,0.6)] text-slate-300 hover:border-violet-400/55 hover:bg-[rgba(168,85,247,0.15)] hover:text-violet-200'
												)}
												on:click={() => setLabStatus(lab, statusKey)}
												type="button"
											>
												{meta.icon}
											</button>
										{/each}
									</div>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>

{#if showNoteModal && activeNoteLab}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
		<div
			class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_45px_120px_rgba(2,8,23,0.75)] backdrop-blur-2xl"
		>
			<header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
				<div>
					<h3 class="text-xl font-bold text-slate-100">
						{activeNoteLab.name} — Notes
					</h3>
					<p class="text-xs text-slate-300/80">
						Markdown supported. Use `![[Screenshot path]]` for screenshot embeds. Exam Prep Mode
						hides walkthrough spoilers.
					</p>
				</div>
				<button
					on:click={closeNoteModal}
					class="rounded-full border border-red-400/60 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
				>
					<X size={18} />
				</button>
			</header>

			<div class="flex-1 space-y-4 overflow-y-auto bg-[rgba(4,12,28,0.65)] p-6">
				{#if activeNoteLab.notes && activeNoteLab.notes.length > 0}
					{#each activeNoteLab.notes as note (note.id)}
						<div class="glass-surface space-y-3 rounded-2xl p-4">
							<div class="flex items-center justify-between text-xs text-slate-300/70">
								<span class="inline-flex items-center gap-2"
									><GripVertical size={14} /> {formatTimestamp(note.timestamp)}</span
								>
								<div class="flex items-center gap-2">
									<button
										on:click={() => startEditIndividualNote(note)}
										class="rounded-full border border-violet-400/60 bg-violet-500/10 p-2 text-violet-200 transition-colors hover:bg-violet-500/20"
										title="Edit note"
									>
										<Edit2 size={16} />
									</button>
									<button
										on:click={() => deleteIndividualNote(note.id)}
										class="rounded-full border border-rose-400/60 bg-rose-500/10 p-2 text-rose-200 transition-colors hover:bg-rose-500/20"
										title="Delete note"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>

							{#if editingIndividualNoteId === note.id}
								<textarea
									bind:value={editingIndividualNoteContent}
									on:input={checkEditingNoteContent}
									class="input-elevated w-full rounded-xl px-3 py-2 font-mono text-sm"
									rows="6"
									maxlength={MAX_NOTE_CHARS}
								></textarea>
								<div class="flex justify-end gap-2">
									<button
										on:click={saveIndividualNote}
										class="inline-flex items-center gap-2 rounded-lg border border-violet-400/60 bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100 shadow-[0_12px_30px_rgba(168,85,247,0.35)] transition-colors hover:bg-violet-500/30"
									>
										<Save size={16} /> Save
									</button>
									<button
										on:click={cancelEditIndividualNote}
										class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[rgba(19,8,48,0.65)] px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-400/50 hover:bg-[rgba(15,23,42,0.75)]"
									>
										<X size={16} /> Cancel
									</button>
								</div>
							{:else}
								<div
									class="prose prose-sm dark:prose-invert prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:text-violet-500 max-w-none"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderNote(note)}
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="glass-surface rounded-2xl p-6 text-center text-slate-300">
						No notes yet. Use the composer below to add recon, foothold, and privesc notes.
					</div>
				{/if}
			</div>

			<footer class="space-y-3 border-t border-white/10 p-6">
				<h4 class="text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">
					Add New Entry
				</h4>
				<textarea
					bind:value={newIndividualNoteContent}
					on:input={checkNewNoteContent}
					rows="4"
					maxlength={MAX_NOTE_CHARS}
					placeholder="Map out attack steps, checklist items, commands, or embed screenshots with ![[Screenshot path]]"
					class="input-elevated w-full rounded-xl px-3 py-3 font-mono text-sm"
				></textarea>
				<div class="flex items-center justify-between text-xs text-slate-300/70">
					<span>
						{newIndividualNoteContent.length}/{MAX_NOTE_CHARS} chars • {Math.min(
							newIndividualNoteContent.split('\n').length,
							MAX_NOTE_LINES
						)}/{MAX_NOTE_LINES} lines
					</span>
					<button
						on:click={addIndividualNote}
						class="inline-flex items-center gap-2 rounded-lg border border-violet-400/60 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 shadow-[0_12px_30px_rgba(168,85,247,0.35)] transition-colors hover:bg-violet-500/30"
					>
						<Plus size={16} /> Add Note
					</button>
				</div>
			</footer>
		</div>
	</div>
{/if}
