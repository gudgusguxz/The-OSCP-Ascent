<script>
	import { labs } from '$lib/stores.js';
	import { preferences } from '$lib/preferencesStore.js';
	import { filterForExamPrep, renderMarkdown } from '$lib/markdown.js';
	import { CalendarRange, Activity, Target, NotebookPen } from 'lucide-svelte';

	const TIMELINE_WIDTH = 960;
	const TIMELINE_HEIGHT = 360;
	const PADDING_X = 70;
	const PADDING_Y = 50;

	let selectedDate = '';
	let focusedEvent = null;

	const toDay = (timestamp) => new Date(timestamp).toISOString().split('T')[0];
	const formatDisplay = (timestamp) =>
		new Date(timestamp).toLocaleString([], {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

	const STATUS_COLORS = {
		owned: '#34d399',
		in_progress: '#fbbf24',
		not_started: '#94a3b8'
	};

	const eventColor = (event) => {
		if (event.type === 'status') {
			return STATUS_COLORS[event.status] || '#94a3b8';
		}
		if (event.type === 'note') return '#38bdf8';
		if (event.type === 'note_edit') return '#60a5fa';
		if (event.type === 'note_delete') return '#f87171';
		return '#94a3b8';
	};

	$: categorySummary = $labs.reduce((acc, lab) => {
		const key = `${lab.source}::${lab.category}`;
		if (!acc.has(key)) {
			acc.set(key, {
				key,
				category: lab.category,
				source: lab.source,
				owned: 0,
				inProgress: 0,
				total: 0
			});
		}
		const entry = acc.get(key);
		entry.total += 1;
		if (lab.status === 'owned') entry.owned += 1;
		if (lab.status === 'in_progress') entry.inProgress += 1;
		return acc;
	}, new Map());

	$: categoryCards = Array.from(categorySummary.values()).sort((a, b) => b.owned - a.owned);

	$: monthlyOwned = $labs
		.filter((lab) => lab.completedAt)
		.map((lab) => ({
			timestamp: lab.completedAt,
			label: new Date(lab.completedAt).toLocaleDateString(undefined, {
				month: 'short',
				year: 'numeric'
			})
		}))
		.reduce((acc, item) => {
			const key = `${item.label}::${toDay(item.timestamp).slice(0, 7)}`;
			if (!acc.has(key)) {
				acc.set(key, { label: item.label, count: 0, timestamp: item.timestamp });
			}
			const entry = acc.get(key);
			entry.count += 1;
			return acc;
		}, new Map());

	$: monthlyCards = Array.from(monthlyOwned.values()).sort(
		(a, b) => new Date(a.timestamp) - new Date(b.timestamp)
	);

	$: timelineEvents = $labs
		.flatMap((lab) => {
			const noteLookup = new Map((lab.notes || []).map((note) => [note.id, note.content]));
			return (lab.history || [])
				.filter(
					(event) =>
						event.timestamp && ['status', 'note', 'note_edit', 'note_delete'].includes(event.type)
				)
				.map((event) => ({
					id: `${lab.id}-${event.id}`,
					labId: lab.id,
					labName: lab.name,
					category: lab.category || 'General',
					timestamp: event.timestamp,
					type: event.type,
					status: event.status || lab.status,
					noteId: event.noteId || null,
					noteContent: noteLookup.get(event.noteId) || '',
					summary: event.summary || ''
				}));
		})
		.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

	$: categoriesForTimeline = timelineEvents.length
		? Array.from(new Set(timelineEvents.map((event) => event.category)))
		: ['General'];

	$: times = timelineEvents.map((event) => new Date(event.timestamp).getTime());
	$: minTime = times.length ? Math.min(...times) : Date.now();
	$: maxTime = times.length ? Math.max(...times) : minTime + 86_400_000;
	$: timeSpan = Math.max(maxTime - minTime, 1);

	$: rowHeight = (TIMELINE_HEIGHT - PADDING_Y * 2) / categoriesForTimeline.length;

	const normalizeToTime = (timestamp) =>
		timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();

	const TIME_GRANULARITY_THRESHOLD = 48 * 60 * 60 * 1000;

	const formatTickLabel = (date) => {
		const value = date instanceof Date ? date : new Date(date);
		if (timeSpan <= TIME_GRANULARITY_THRESHOLD) {
			return value.toLocaleString([], {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
		return value.toLocaleDateString();
	};

	const toX = (timestamp) => {
		const time = normalizeToTime(timestamp);
		const ratio = (time - minTime) / timeSpan;
		return PADDING_X + ratio * (TIMELINE_WIDTH - PADDING_X * 2);
	};

	const toY = (category) => {
		const index = Math.max(categoriesForTimeline.indexOf(category), 0);
		return PADDING_Y + index * rowHeight + rowHeight / 2;
	};

	$: tickMarks = timelineEvents.length
		? Array.from({ length: 5 }, (_, index) => {
				const value = new Date(minTime + (timeSpan * index) / 4);
				return {
					value,
					x: toX(value),
					label: formatTickLabel(value)
				};
			})
		: [];

	$: selectedEvents = selectedDate
		? timelineEvents.filter((event) => toDay(event.timestamp) === selectedDate)
		: [];

	function focusEvent(event) {
		focusedEvent = event;
		selectedDate = toDay(event.timestamp);
	}

	const notePreview = (event) => {
		if (!event.noteContent) return '';
		const source = $preferences.examPrepMode
			? filterForExamPrep(event.noteContent)
			: event.noteContent;
		return renderMarkdown(source);
	};
</script>

<svelte:head>
	<title>Root Quest 2.0 — Timeline & Graphs</title>
</svelte:head>

<section class="space-y-8">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-50">
			Timeline & Graph Control Room
		</h1>
		<p class="max-w-2xl text-slate-500 dark:text-slate-400">
			Visualise your lab grind. Track owned boxes per category, monitor monthly throughput, and
			drill into every note or status change on the timeline. Exam Prep Mode keeps spoilers hidden
			while retaining your command checklists.
		</p>
	</header>

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
		<div
			class="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase dark:text-slate-300"
			>
				<Target size={16} /> Owned by Category
			</div>
			<div class="space-y-3">
				{#if categoryCards.length === 0}
					<p class="text-sm text-slate-500 dark:text-slate-400">
						No labs tracked yet. Head back to the dashboard to add some targets.
					</p>
				{:else}
					{#each categoryCards.slice(0, 6) as card (card.key)}
						<div class="space-y-1">
							<div class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
								<span>{card.category}</span>
								<span>{card.owned}/{card.total} owned</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
								<div
									class="h-full bg-emerald-500"
									style={`width: ${card.total === 0 ? 0 : Math.min(100, (card.owned / card.total) * 100)}%;`}
								></div>
							</div>
							<p class="text-[11px] text-slate-400 dark:text-slate-500">
								⏳ {card.inProgress} in progress
							</p>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div
			class="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase dark:text-slate-300"
			>
				<CalendarRange size={16} /> Monthly Owned Pace
			</div>
			<div class="space-y-2">
				{#if monthlyCards.length === 0}
					<p class="text-sm text-slate-500 dark:text-slate-400">
						No owned labs yet. Log a completion to unlock this chart.
					</p>
				{:else}
					{#each monthlyCards as month (month.label)}
						<div
							class="flex items-center justify-between text-sm text-slate-500 dark:text-slate-300"
						>
							<span>{month.label}</span>
							<span class="font-semibold text-emerald-500">{month.count}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div
			class="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase dark:text-slate-300"
			>
				<Activity size={16} /> Daily Drilldown
			</div>
			<label class="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400"
				>Choose a day</label
			>
			<input
				type="date"
				bind:value={selectedDate}
				class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
			/>
			<div class="max-h-40 space-y-2 overflow-y-auto text-sm">
				{#if selectedEvents.length === 0}
					<p class="text-sm text-slate-500 dark:text-slate-400">
						No activity recorded for this date yet.
					</p>
				{:else}
					{#each selectedEvents as event (event.id)}
						<button
							class="w-full rounded-xl bg-slate-100 px-3 py-2 text-left transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 dark:bg-slate-800/60 dark:hover:text-emerald-300"
							on:click={() => (focusedEvent = event)}
						>
							<p class="text-xs text-slate-500 uppercase dark:text-slate-400">{event.labName}</p>
							<p class="text-sm">{event.summary || event.type}</p>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<section
		class="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
	>
		<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Interactive Timeline</h2>
			<p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
				Hover and click points to inspect note drops, status changes, and owned completions.
				Categories are separated vertically while time flows left to right.
			</p>
		</header>

		{#if timelineEvents.length === 0}
			<div
				class="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400"
			>
				No events captured yet. Update statuses or add notes from the dashboard to populate this
				view.
			</div>
		{:else}
			<div class="w-full overflow-x-auto">
				<svg viewBox={`0 0 ${TIMELINE_WIDTH} ${TIMELINE_HEIGHT}`} class="min-w-full">
					<!-- Category grid lines -->
					{#each categoriesForTimeline as category, index (category)}
						<line
							x1={PADDING_X}
							y1={PADDING_Y + index * rowHeight}
							x2={TIMELINE_WIDTH - PADDING_X}
							y2={PADDING_Y + index * rowHeight}
							stroke="rgba(148,163,184,0.25)"
							stroke-width="1"
						/>
						<text
							x={PADDING_X - 15}
							y={PADDING_Y + index * rowHeight + rowHeight / 2}
							text-anchor="end"
							alignment-baseline="middle"
							class="fill-slate-500 text-xs dark:fill-slate-400"
						>
							{category}
						</text>
					{/each}

					<!-- Axis line -->
					<line
						x1={PADDING_X}
						y1={TIMELINE_HEIGHT - PADDING_Y}
						x2={TIMELINE_WIDTH - PADDING_X}
						y2={TIMELINE_HEIGHT - PADDING_Y}
						stroke="rgba(148,163,184,0.6)"
						stroke-width="1.5"
					/>

					<!-- Tick marks -->
					{#each tickMarks as tick (tick.value.toISOString())}
						<g>
							<line
								x1={tick.x}
								y1={TIMELINE_HEIGHT - PADDING_Y}
								x2={tick.x}
								y2={TIMELINE_HEIGHT - PADDING_Y + 8}
								stroke="rgba(148,163,184,0.8)"
								stroke-width="1"
							/>
							<text
								x={tick.x}
								y={TIMELINE_HEIGHT - PADDING_Y + 22}
								text-anchor="middle"
								class="fill-slate-500 text-xs dark:fill-slate-400"
							>
								{tick.label}
							</text>
						</g>
					{/each}

					<!-- Events -->
					{#each timelineEvents as event (event.id)}
						<g on:click={() => focusEvent(event)} class="cursor-pointer">
							<circle
								cx={toX(event.timestamp)}
								cy={toY(event.category)}
								r={focusedEvent && focusedEvent.id === event.id ? 7 : 5}
								fill={eventColor(event)}
								opacity={selectedDate && toDay(event.timestamp) !== selectedDate ? 0.4 : 0.9}
							/>
							<title
								>{event.labName} — {event.summary || event.type} ({formatDisplay(
									event.timestamp
								)})</title
							>
						</g>
					{/each}
				</svg>
			</div>
		{/if}
	</section>

	{#if focusedEvent}
		<section
			class="space-y-4 rounded-3xl border border-emerald-200 bg-white p-6 dark:border-emerald-900 dark:bg-slate-900"
		>
			<header class="flex items-center gap-3">
				<NotebookPen size={24} class="text-emerald-500" />
				<div>
					<h3 class="text-xl font-semibold text-slate-800 dark:text-slate-100">
						{focusedEvent.labName}
					</h3>
					<p class="text-sm text-slate-500 dark:text-slate-400">
						{focusedEvent.summary || focusedEvent.type} • {formatDisplay(focusedEvent.timestamp)}
					</p>
				</div>
			</header>

			{#if focusedEvent.noteContent}
				<div
					class="prose prose-sm dark:prose-invert prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:text-emerald-500 max-w-none"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html notePreview(focusedEvent)}
				</div>
			{:else}
				<p class="text-sm text-slate-500 dark:text-slate-400">
					No note body captured for this event.
				</p>
			{/if}
		</section>
	{/if}
</section>
