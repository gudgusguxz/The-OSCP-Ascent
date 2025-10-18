<script>
	import { onDestroy, onMount } from 'svelte';

	import { labs } from '$lib/stores.js';
	import { preferences } from '$lib/preferencesStore.js';
	import { filterForExamPrep, renderMarkdown } from '$lib/markdown.js';
	import {
		Activity,
		NotebookPen,
		Bird,
		Computer,
		Bot,
		Circle as CircleIcon,
		Sparkles,
		Compass,
		Wand2
	} from 'lucide-svelte';

	const MIN_TIMELINE_WIDTH = 960;
	const TIMELINE_HEIGHT = 360;
	const PADDING_X = 160;
	const PADDING_Y = 50;
	const LABEL_GUTTER = 16;

	let selectedDate = '';
	let focusedEvent = null;
	let timelineWidth = MIN_TIMELINE_WIDTH;
	let timelineShell;
	let resizeObserver;
	let ownedGroupMode = 'source';

	onMount(() => {
		if (!timelineShell) return;

		const updateWidth = (entry) => {
			const { width } = entry.contentRect;
			timelineWidth = Math.max(MIN_TIMELINE_WIDTH, Math.round(width));
		};

		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				updateWidth(entry);
			}
		});

		updateWidth({ contentRect: { width: timelineShell.clientWidth || MIN_TIMELINE_WIDTH } });
		resizeObserver.observe(timelineShell);

		return () => {
			resizeObserver?.disconnect();
			resizeObserver = undefined;
		};
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		resizeObserver = undefined;
	});

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

	const fallbackLabel = (value, fallback = 'Unknown') =>
		(value && String(value).trim()) || fallback;

	const shareFormatter = (value) => {
		if (!Number.isFinite(value)) return '0%';
		if (value >= 10 || value === 0) return `${Math.round(value)}%`;
		return `${Math.round(value * 10) / 10}%`;
	};

	const previewLimit = 4;

	const difficultyRanks = new Map([
		['very easy', 0],
		['easy', 1],
		['beginner', 1],
		['medium', 2],
		['intermediate', 2],
		['hard', 3],
		['insane', 4],
		['expert', 4]
	]);

	const difficultyAccent = (value) => {
		const normalized = (value || '').toLowerCase();
		if (normalized.includes('very easy')) return 'rgb(52 211 153)';
		if (normalized.includes('easy')) return 'rgb(96 165 250)';
		if (normalized.includes('medium') || normalized.includes('intermediate'))
			return 'rgb(129 140 248)';
		if (normalized.includes('hard')) return 'rgb(248 113 113)';
		if (normalized.includes('insane') || normalized.includes('expert')) return 'rgb(249 115 22)';
		return 'rgb(192 132 252)';
	};

	const difficultyOrder = (value) => {
		const normalized = (value || '').toLowerCase();
		return difficultyRanks.get(normalized) ?? difficultyRanks.get(normalized.split(' ')[0]) ?? 5;
	};

	const ownedGroupingOptions = [
		{
			id: 'source',
			chipLabel: 'Provider',
			headline: 'Providers',
			description: 'Compare completions across lab vendors.',
			icon: Computer,
			getKey: (lab) => fallbackLabel(lab.source, 'Independent'),
			formatLabel: (value) => fallbackLabel(value, 'Independent Provider'),
			resolveAccent: () => 'rgb(59 130 246)',
			resolveIcon: () => Computer,
			formatSummary: (group, share) =>
				`${group.count} cleared • ${shareFormatter(share)} of owned fleet`,
			formatHighlight: (group, latest) =>
				latest?.completedLabel ? `Latest: ${latest.completedLabel}` : '',
			moreSuffix: 'more cleared in this provider'
		},
		{
			id: 'os',
			chipLabel: 'Operating System',
			headline: 'Operating systems',
			description: 'See which platforms you have the most experience with.',
			icon: Compass,
			getKey: (lab) => fallbackLabel(lab.os, 'Unknown OS'),
			formatLabel: (value) => fallbackLabel(value, 'Unknown OS'),
			resolveAccent: (group) => {
				const osKey = deriveOsKey(group.key);
				if (osKey === 'linux') return 'rgb(34 197 94)';
				if (osKey === 'windows') return 'rgb(96 165 250)';
				if (osKey === 'ad') return 'rgb(250 204 21)';
				return 'rgb(192 132 252)';
			},
			resolveIcon: (group) => {
				const osKey = deriveOsKey(group.key);
				if (osKey === 'linux') return Bird;
				if (osKey === 'windows') return Computer;
				if (osKey === 'ad') return Bot;
				return CircleIcon;
			},
			formatSummary: (group, share) =>
				`${group.count} cleared • ${shareFormatter(share)} of owned fleet`,
			formatHighlight: (group, latest) =>
				latest?.completedLabel ? `Latest: ${latest.completedLabel}` : '',
			sorter: (a, b) => {
				const order = ['windows', 'linux', 'ad'];
				const indexOf = (value) => {
					const key = deriveOsKey(value);
					const idx = order.indexOf(key);
					return idx === -1 ? 99 : idx;
				};
				const orderDelta = indexOf(a.key) - indexOf(b.key);
				if (orderDelta !== 0) return orderDelta;
				return b.count - a.count || a.label.localeCompare(b.label);
			},
			moreSuffix: 'more labs on this platform'
		},
		{
			id: 'difficulty',
			chipLabel: 'Difficulty',
			headline: 'Difficulty bands',
			description: 'Balance your clears across easier practice and serious challenges.',
			icon: Sparkles,
			getKey: (lab) => fallbackLabel(lab.difficulty, 'Unknown difficulty'),
			formatLabel: (value) => fallbackLabel(value, 'Unknown difficulty'),
			resolveAccent: (group) => difficultyAccent(group.key),
			resolveIcon: () => Sparkles,
			formatSummary: (group, share) =>
				`${group.count} cleared • ${shareFormatter(share)} of owned fleet`,
			formatHighlight: (group, latest) =>
				latest?.completedLabel ? `Last cleared ${latest.completedLabel}` : '',
			sorter: (a, b) => {
				const orderDelta = difficultyOrder(a.key) - difficultyOrder(b.key);
				if (orderDelta !== 0) return orderDelta;
				return b.count - a.count || a.label.localeCompare(b.label);
			},
			moreSuffix: 'more runs at this difficulty'
		}
	];

	const ownedGroupingLookup = Object.fromEntries(
		ownedGroupingOptions.map((option) => [option.id, option])
	);

	const buildGrouping = (labs, option) => {
		const groups = new Map();
		const total = labs.length || 1;

		for (const lab of labs) {
			const rawKey = option.getKey(lab);
			const key = rawKey || 'Unknown';
			if (!groups.has(key)) {
				groups.set(key, {
					key,
					labs: []
				});
			}
			groups.get(key).labs.push(lab);
		}

		return Array.from(groups.values())
			.map((group) => {
				const count = group.labs.length;
				const share = (count / total) * 100;
				const latest = group.labs.find((lab) => lab.completedLabel);
				const accent = option.resolveAccent ? option.resolveAccent(group) : 'rgb(129 140 248)';
				const icon = option.resolveIcon ? option.resolveIcon(group) : null;
				return {
					...group,
					label: option.formatLabel ? option.formatLabel(group.key, group) : group.key,
					count,
					share,
					shareLabel: `${shareFormatter(share)} of owned fleet`,
					accent,
					icon,
					summary: option.formatSummary
						? option.formatSummary({ ...group, count }, share)
						: `${count} cleared`,
					highlight: option.formatHighlight
						? option.formatHighlight({ ...group, count }, latest)
						: latest?.completedLabel
							? `Latest: ${latest.completedLabel}`
							: '',
					labsPreview: group.labs.slice(0, previewLimit),
					remainder: Math.max(count - previewLimit, 0)
				};
			})
			.sort(option.sorter ?? ((a, b) => b.count - a.count || a.label.localeCompare(b.label)));
	};

	const completionDateFormatter = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	const eventColor = (event) => {
		if (event.type === 'status') {
			return STATUS_COLORS[event.status] || '#94a3b8';
		}
		if (event.type === 'note') return '#38bdf8';
		if (event.type === 'note_edit') return '#60a5fa';
		if (event.type === 'note_delete') return '#f87171';
		return '#94a3b8';
	};

	const deriveOsKey = (os) => {
		const value = (os || '').toLowerCase();
		if (value.includes('linux')) return 'linux';
		if (value.includes('window')) return 'windows';
		if (value.includes('directory') || value === 'ad') return 'ad';
		return 'generic';
	};

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
					summary: event.summary || '',
					os: lab.os || 'Unknown',
					osIcon: deriveOsKey(lab.os),
					avatar: lab.avatar || ''
				}));
		})
		.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

	$: categoriesForTimeline = timelineEvents.length
		? Array.from(new Set(timelineEvents.map((event) => event.category)))
		: ['General'];

	$: totalLabsTracked = timelineEvents.length
		? new Set(timelineEvents.map((event) => event.labId)).size
		: 0;
	$: totalNotesLogged = timelineEvents.filter((event) => event.type.startsWith('note')).length;
	$: totalStatusChanges = timelineEvents.filter((event) => event.type === 'status').length;
	$: uniqueDays = timelineEvents.length
		? Array.from(new Set(timelineEvents.map((event) => toDay(event.timestamp)))).sort(
				(a, b) => new Date(b).getTime() - new Date(a).getTime()
			)
		: [];

	$: times = timelineEvents.map((event) => new Date(event.timestamp).getTime());
	$: minTime = times.length ? Math.min(...times) : Date.now();
	$: maxTime = times.length ? Math.max(...times) : minTime + 86_400_000;
	$: timeSpan = Math.max(maxTime - minTime, 1);

	$: rowHeight = (TIMELINE_HEIGHT - PADDING_Y * 2) / categoriesForTimeline.length;

	$: ownedLabs = $labs.filter(
		(lab) => (lab.status || '').toLowerCase() === 'owned' || lab.completed
	);
	$: ownedLabsDetailed = ownedLabs.map((lab) => {
		const completedAtDate = lab.completedAt ? new Date(lab.completedAt) : null;
		return {
			id: lab.id,
			name: fallbackLabel(lab.name, 'Unnamed Lab'),
			difficulty: fallbackLabel(lab.difficulty, 'Unknown difficulty'),
			os: fallbackLabel(lab.os, 'Unknown OS'),
			source: fallbackLabel(lab.source, 'Independent'),
			category: fallbackLabel(lab.category, 'General'),
			completedAt: completedAtDate,
			completedLabel: completedAtDate ? completionDateFormatter.format(completedAtDate) : ''
		};
	});

	$: ownedLabsOrdered = ownedLabsDetailed.slice().sort((a, b) => {
		const aTime = a.completedAt ? a.completedAt.getTime() : 0;
		const bTime = b.completedAt ? b.completedAt.getTime() : 0;
		return bTime - aTime;
	});

	$: totalOwnedLabs = ownedLabsOrdered.length;
	$: ownedGroupings = Object.fromEntries(
		ownedGroupingOptions.map((option) => [option.id, buildGrouping(ownedLabsOrdered, option)])
	);
	$: ownedActiveGroups = ownedGroupings[ownedGroupMode] ?? [];
	$: activeGroupingOption = ownedGroupingLookup[ownedGroupMode] ?? ownedGroupingOptions[0];
	$: ownedProvidersCount = ownedGroupings.source?.length ?? 0;
	$: ownedOsCoverage = new Set(ownedLabsOrdered.map((lab) => lab.os)).size;

	const normalizeToTime = (timestamp) =>
		timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();

	const TIME_GRANULARITY_THRESHOLD = 48 * 60 * 60 * 1000;

	const isEventFocused = (event) => focusedEvent && focusedEvent.id === event.id;
	const eventRadius = (event) => (isEventFocused(event) ? 13 : 10);
	const eventIconSize = (event) => (isEventFocused(event) ? 22 : 16);
	const eventAvatar = (event) => (event.avatar || '').trim();
	const eventGlow = (event) => (isEventFocused(event) ? '0 0 22px' : '0 0 14px');

	const shortTickFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	const longTickFormatter = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	const formatTickLabel = (date) => {
		const value = date instanceof Date ? date : new Date(date);
		return timeSpan <= TIME_GRANULARITY_THRESHOLD
			? shortTickFormatter.format(value)
			: longTickFormatter.format(value);
	};

	const toX = (timestamp) => {
		const time = normalizeToTime(timestamp);
		const ratio = (time - minTime) / timeSpan;
		return PADDING_X + ratio * (timelineWidth - PADDING_X * 2);
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
	<title>Hack Ascent HQ — Timeline & Graphs</title>
</svelte:head>

<section class="space-y-8">
	<header class="hero-card">
		<div class="hero-backdrop" aria-hidden="true"></div>
		<div class="hero-grid" aria-hidden="true"></div>
		<div class="hero-content">
			<div class="hero-icon">
				<Compass size={26} strokeWidth={2.6} />
			</div>
			<div>
				<p class="hero-eyebrow">Mission Ops</p>
				<h2 class="hero-title">Timeline of Progress</h2>
				<p class="hero-copy">
					Our bespoke control room view for tracking every pivot, escalation, and breakthrough
					across labs. Glide through the holographic timeline, spotlight the key drops, and
					resurface context instantly.
				</p>
			</div>
			<div class="hero-actions">
				<span class="hero-badge">
					<Wand2 size={16} />
					Curated for Hack Ascent
				</span>
			</div>
		</div>
	</header>

	{#if timelineEvents.length}
		<section
			class="grid gap-3 rounded-3xl border border-slate-700/30 bg-slate-900/60 p-5 shadow-lg backdrop-blur"
		>
			<div
				class="flex items-center gap-2 text-sm font-medium tracking-wide text-indigo-300 uppercase"
			>
				<Sparkles class="h-4 w-4" /> Signal Boost
			</div>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="metric-tile">
					<span class="metric-label">Labs Owned</span>
					<span class="metric-value">{totalOwnedLabs}</span>
				</div>
				<div class="metric-tile">
					<span class="metric-label">Active Labs Tracked</span>
					<span class="metric-value">{totalLabsTracked}</span>
				</div>
				<div class="metric-tile">
					<span class="metric-label">Status Evolutions</span>
					<span class="metric-value">{totalStatusChanges}</span>
				</div>
				<div class="metric-tile">
					<span class="metric-label">Notes Captured</span>
					<span class="metric-value">{totalNotesLogged}</span>
				</div>
			</div>

			{#if totalOwnedLabs}
				<div class="owned-metrics">
					<div class="owned-metric">
						<span class="owned-metric__label">Providers Engaged</span>
						<span class="owned-metric__value">{ownedProvidersCount}</span>
					</div>
					<div class="owned-metric">
						<span class="owned-metric__label">OS Coverage</span>
						<span class="owned-metric__value">{ownedOsCoverage}</span>
					</div>
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300/70">
				<div class="legend-item">
					<span class="legend-dot" style={`--color: ${STATUS_COLORS.owned}`}></span>
					Owned
				</div>
				<div class="legend-item">
					<span class="legend-dot" style={`--color: ${STATUS_COLORS.in_progress}`}></span>
					In Progress
				</div>
				<div class="legend-item">
					<span class="legend-dot" style={`--color: ${STATUS_COLORS.not_started}`}></span>
					Backlog
				</div>
				<div class="legend-item">
					<span class="legend-dot note"></span> Notes & edits
				</div>
			</div>
		</section>
	{/if}

	{#if uniqueDays.length}
		<section class="glass-surface date-selector">
			<div class="date-selector__header">
				<Activity size={18} class="text-indigo-400" />
				<span>Pulse by Day</span>
			</div>
			<div class="date-selector__chips">
				{#each uniqueDays.slice(0, 6) as day (day)}
					<button
						type="button"
						class:active={day === selectedDate}
						on:click={() => {
							selectedDate = selectedDate === day ? '' : day;
							focusedEvent = selectedDate
								? timelineEvents.find((event) => toDay(event.timestamp) === day)
								: null;
						}}
					>
						<span>{new Date(day).toLocaleDateString()}</span>
					</button>
				{/each}
				{#if uniqueDays.length > 6}
					<span class="date-selector__more">+{uniqueDays.length - 6} more</span>
				{/if}
			</div>
			{#if selectedDate}
				<button
					class="date-selector__clear"
					type="button"
					on:click={() => {
						selectedDate = '';
						focusedEvent = null;
					}}
				>
					Clear focus
				</button>
			{/if}
		</section>
	{/if}

	{#if totalOwnedLabs}
		<section class="glass-surface owned-overview">
			<header class="owned-overview__header">
				<div class="owned-overview__icon">
					<NotebookPen size={18} strokeWidth={2.4} />
				</div>
				<div>
					<p class="owned-overview__eyebrow">Owned Fleet Overview</p>
					<h3 class="owned-overview__title">Snapshot of Completed Labs</h3>
				</div>
			</header>

			<div class="owned-overview__controls">
				<div class="owned-overview__descriptor">
					<span class="owned-overview__viewing">Viewing by</span>
					<h4>{activeGroupingOption?.headline}</h4>
					<p>{activeGroupingOption?.description}</p>
				</div>
				<div class="owned-group-toggle" role="group" aria-label="Change snapshot view">
					{#each ownedGroupingOptions as option (option.id)}
						<button
							type="button"
							class:active={ownedGroupMode === option.id}
							on:click={() => {
								ownedGroupMode = option.id;
							}}
						>
							<svelte:component this={option.icon} size={16} strokeWidth={2.6} />
							<span>{option.chipLabel}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if ownedActiveGroups.length === 0}
				<p class="owned-groups__empty">Log a few completions to populate this snapshot.</p>
			{:else}
				<div class="owned-groups">
					{#each ownedActiveGroups as group (group.label)}
						<article class="owned-group-card" style={`--accent:${group.accent}`}>
							<header class="owned-group-card__header">
								<div class="owned-group-card__title">
									<span class="owned-group-card__badge">
										{#if group.icon}
											<svelte:component this={group.icon} size={16} strokeWidth={2.6} />
										{/if}
										{group.label}
									</span>
									<p>{group.summary}</p>
								</div>
								<div class="owned-group-card__stat">
									<span class="owned-group-card__count">{group.count}</span>
									<span class="owned-group-card__share">{group.shareLabel}</span>
								</div>
							</header>
							<div
								class="owned-group-card__meter"
								style={`--owned-share:${group.share}; --owned-accent:${group.accent}`}
							></div>
							{#if group.highlight}
								<p class="owned-group-card__highlight">{group.highlight}</p>
							{/if}
							<ul class="owned-group-list">
								{#each group.labsPreview as lab (lab.id)}
									<li>
										<div class="owned-lab__info">
											<span class="owned-lab__name">{lab.name}</span>
											<span class="owned-lab__meta">{lab.difficulty} · {lab.os}</span>
										</div>
										{#if lab.completedLabel}
											<span class="owned-lab__date">{lab.completedLabel}</span>
										{/if}
									</li>
								{/each}
								{#if group.remainder}
									<li class="owned-group-list__more">
										+{group.remainder}
										{activeGroupingOption?.moreSuffix || 'more labs in this view'}
									</li>
								{/if}
							</ul>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if timelineEvents.length === 0}
		<div
			class="glass-surface border border-dashed border-indigo-400/25 p-10 text-center text-slate-300"
		>
			No events captured yet. Update statuses or add notes from the dashboard to populate this view.
		</div>
	{:else}
		<div class="timeline-shell" bind:this={timelineShell}>
			<div aria-hidden="true" class="timeline-glow"></div>
			<svg viewBox={`0 0 ${timelineWidth} ${TIMELINE_HEIGHT}`} class="timeline-canvas">
				<!-- Category grid lines -->
				{#each categoriesForTimeline as category, index (category)}
					<line
						x1={PADDING_X}
						y1={PADDING_Y + index * rowHeight}
						x2={timelineWidth - PADDING_X}
						y2={PADDING_Y + index * rowHeight}
						stroke="rgba(148,163,184,0.25)"
						stroke-width="1"
					/>
					<foreignObject
						x={0}
						y={PADDING_Y + index * rowHeight}
						width={PADDING_X - LABEL_GUTTER}
						height={rowHeight}
						pointer-events="none"
					>
						<div
							xmlns="http://www.w3.org/1999/xhtml"
							class="flex h-full items-center justify-end pr-2 text-xs text-slate-400/80"
						>
							<span class="truncate" title={category}>{category}</span>
						</div>
					</foreignObject>
				{/each}

				<!-- Axis line -->
				<line
					x1={PADDING_X}
					y1={TIMELINE_HEIGHT - PADDING_Y}
					x2={timelineWidth - PADDING_X}
					y2={TIMELINE_HEIGHT - PADDING_Y}
					stroke="rgba(148,163,184,0.6)"
					stroke-width="1.5"
				/>

				<!-- Tick marks -->
				{#each tickMarks as tick (tick.value.getTime())}
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
							fill="rgba(148,163,184,0.85)"
							class="text-xs"
						>
							{tick.label}
						</text>
					</g>
				{/each}

				<!-- Events -->
				{#each timelineEvents as event (event.id)}
					<g
						role="button"
						tabindex="0"
						class="cursor-pointer"
						on:click={() => focusEvent(event)}
						on:keydown={(eventDetail) => {
							if (eventDetail.key === 'Enter' || eventDetail.key === ' ') {
								eventDetail.preventDefault();
								focusEvent(event);
							}
						}}
					>
						<circle
							cx={toX(event.timestamp)}
							cy={toY(event.category)}
							r={eventRadius(event) + 3}
							fill="rgba(15,23,42,0.65)"
							stroke="rgba(148,163,184,0.15)"
							stroke-width="1.5"
						/>
						<circle
							cx={toX(event.timestamp)}
							cy={toY(event.category)}
							r={eventRadius(event)}
							fill={eventColor(event)}
							opacity={selectedDate && toDay(event.timestamp) !== selectedDate ? 0.35 : 0.95}
							style={`filter: drop-shadow(${eventGlow(event)} ${eventColor(event)})`}
							stroke="rgba(15,23,42,0.6)"
							stroke-width={isEventFocused(event) ? 2.5 : 1.5}
						/>
						<foreignObject
							x={toX(event.timestamp) - eventIconSize(event) / 2}
							y={toY(event.category) - eventIconSize(event) / 2}
							width={eventIconSize(event)}
							height={eventIconSize(event)}
							pointer-events="none"
						>
							<div xmlns="http://www.w3.org/1999/xhtml" class="event-icon-wrapper">
								{#if eventAvatar(event)}
									<img
										src={eventAvatar(event)}
										alt={`${event.labName} icon`}
										referrerpolicy="no-referrer"
										class:focused={isEventFocused(event)}
									/>
								{:else if event.osIcon === 'linux'}
									<Bird size={eventIconSize(event) - 6} strokeWidth={2.8} class="text-white" />
								{:else if event.osIcon === 'windows'}
									<Computer size={eventIconSize(event) - 6} strokeWidth={2.8} class="text-white" />
								{:else if event.osIcon === 'ad'}
									<Bot size={eventIconSize(event) - 6} strokeWidth={2.8} class="text-white" />
								{:else}
									<CircleIcon
										size={eventIconSize(event) - 6}
										strokeWidth={2.8}
										class="text-white"
									/>
								{/if}
							</div>
						</foreignObject>
						<title>
							{event.labName} — {event.summary || event.type} ({formatDisplay(event.timestamp)}) • {event.os}
						</title>
					</g>
				{/each}
			</svg>
		</div>
	{/if}
</section>

{#if focusedEvent}
	<section class="glass-surface focus-panel space-y-4 rounded-3xl p-6">
		<header class="flex items-center gap-3">
			<NotebookPen size={24} class="text-violet-400" />
			<div>
				<h3 class="text-xl font-semibold text-slate-100">
					{focusedEvent.labName}
				</h3>
				<p class="text-sm text-slate-300/80">
					{focusedEvent.summary || focusedEvent.type} • {formatDisplay(focusedEvent.timestamp)}
				</p>
			</div>
		</header>

		{#if focusedEvent.noteContent}
			<div class="prose prose-invert max-w-none">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html notePreview(focusedEvent)}
			</div>
		{/if}
	</section>
{/if}

<style>
	.hero-card {
		position: relative;
		overflow: hidden;
		border-radius: 2rem;
		padding: clamp(1.75rem, 4vw, 3rem);
		border: 1px solid rgba(217, 70, 239, 0.35);
		background: linear-gradient(135deg, rgba(32, 12, 58, 0.95), rgba(126, 34, 206, 0.35));
		box-shadow: 0 25px 55px rgba(74, 23, 116, 0.6);
	}

	.hero-backdrop {
		position: absolute;
		inset: -20% -10%;
		background:
			radial-gradient(circle at 20% 15%, rgba(217, 70, 239, 0.35), transparent 55%),
			radial-gradient(circle at 75% 40%, rgba(129, 140, 248, 0.3), transparent 60%),
			radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.32), transparent 65%);
		filter: blur(20px);
		opacity: 0.8;
	}

	.hero-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
		background-size: 60px 60px;
		mask-image: radial-gradient(circle at center, rgba(255, 255, 255, 0.7), transparent 65%);
	}

	.hero-content {
		position: relative;
		display: grid;
		gap: 1.5rem;
		align-items: start;
		grid-template-columns: auto 1fr;
	}

	.hero-icon {
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 1rem;
		background: rgba(168, 85, 247, 0.22);
		border: 1px solid rgba(217, 70, 239, 0.45);
		color: rgb(250, 245, 255);
		box-shadow: 0 10px 30px rgba(168, 85, 247, 0.35);
	}

	.hero-eyebrow {
		font-size: 0.8rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgba(244, 114, 182, 0.85);
		margin-bottom: 0.45rem;
	}

	.hero-title {
		font-size: clamp(1.9rem, 4vw, 2.75rem);
		font-weight: 700;
		color: rgb(226, 232, 240);
		margin-bottom: 0.75rem;
	}

	.hero-copy {
		max-width: 48ch;
		color: rgba(226, 232, 240, 0.78);
		font-size: 0.95rem;
		line-height: 1.65;
	}

	.hero-actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-start;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(217, 70, 239, 0.5);
		background: linear-gradient(120deg, rgba(217, 70, 239, 0.32), rgba(168, 85, 247, 0.25));
		padding: 0.35rem 0.9rem;
		color: rgb(250, 245, 255);
		font-size: 0.8rem;
		letter-spacing: 0.05em;
	}

	.metric-tile {
		position: relative;
		border-radius: 1rem;
		border: 1px solid rgba(192, 132, 252, 0.25);
		background: linear-gradient(180deg, rgba(126, 34, 206, 0.2), rgba(12, 5, 32, 0.7));
		padding: 1.15rem;
		box-shadow: inset 0 1px 0 rgba(192, 132, 252, 0.25);
	}

	.metric-label {
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(221, 214, 254, 0.85);
	}

	.metric-value {
		margin-top: 0.75rem;
		display: block;
		font-size: 1.875rem;
		font-weight: 600;
		color: rgb(226, 232, 240);
		text-shadow: 0 8px 20px rgba(126, 34, 206, 0.35);
	}

	.owned-metrics {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	}

	.owned-metric {
		border-radius: 0.85rem;
		border: 1px solid rgba(79, 70, 229, 0.35);
		background: rgba(15, 23, 42, 0.6);
		padding: 0.85rem 1rem;
		box-shadow: inset 0 1px 0 rgba(129, 140, 248, 0.25);
	}

	.owned-metric__label {
		display: block;
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(191, 219, 254, 0.75);
	}

	.owned-metric__value {
		margin-top: 0.35rem;
		display: block;
		font-size: 1.45rem;
		font-weight: 600;
		color: rgb(224, 231, 255);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(51, 65, 85, 0.4);
		background: rgba(12, 5, 32, 0.65);
		padding: 0.25rem 0.75rem;
		box-shadow: 0 8px 18px rgba(32, 12, 58, 0.4);
	}

	.legend-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 9999px;
		background: var(--color, #d946ef);
		box-shadow: 0 0 14px rgba(217, 70, 239, 0.55);
	}

	.legend-dot.note {
		background: linear-gradient(135deg, #d946ef, #c084fc);
		box-shadow: 0 0 14px rgba(192, 132, 252, 0.75);
	}

	.date-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
	}

	.date-selector__header {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(244, 114, 182, 0.85);
	}

	.date-selector__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.date-selector button {
		border-radius: 9999px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(15, 23, 42, 0.7);
		color: rgba(226, 232, 240, 0.88);
		padding: 0.35rem 0.85rem;
		font-size: 0.85rem;
		transition: all 0.2s ease;
	}

	.date-selector button:hover {
		border-color: rgba(217, 70, 239, 0.55);
		color: rgb(250, 245, 255);
	}

	.date-selector button.active {
		border-color: rgba(217, 70, 239, 0.8);
		background: rgba(217, 70, 239, 0.2);
		color: rgb(250, 245, 255);
		box-shadow: 0 8px 22px rgba(217, 70, 239, 0.35);
	}

	.date-selector__more {
		align-self: center;
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.75);
	}

	.date-selector__clear {
		margin-left: auto;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(203, 213, 225, 0.85);
	}

	.owned-overview {
		display: grid;
		gap: 1.75rem;
		border: 1px solid rgba(56, 189, 248, 0.25);
		background: linear-gradient(160deg, rgba(14, 165, 233, 0.15), rgba(15, 23, 42, 0.75));
	}

	.owned-overview__header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.owned-overview__icon {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.85rem;
		background: rgba(56, 189, 248, 0.2);
		color: rgb(191, 219, 254);
		border: 1px solid rgba(56, 189, 248, 0.45);
	}

	.owned-overview__eyebrow {
		font-size: 0.78rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(165, 243, 252, 0.75);
	}

	.owned-overview__title {
		font-size: clamp(1.4rem, 3vw, 1.8rem);
		font-weight: 600;
		color: rgb(224, 231, 255);
		margin-top: 0.25rem;
	}

	.owned-overview__controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: stretch;
		justify-content: space-between;
		margin-top: 1.5rem;
	}

	.owned-overview__descriptor {
		display: grid;
		gap: 0.35rem;
		max-width: 30rem;
	}

	.owned-overview__descriptor h4 {
		font-size: clamp(1.05rem, 2.4vw, 1.35rem);
		font-weight: 600;
		color: rgb(224, 231, 255);
	}

	.owned-overview__descriptor p {
		font-size: 0.9rem;
		color: rgba(191, 219, 254, 0.78);
		line-height: 1.5;
	}

	.owned-overview__viewing {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.24em;
		color: rgba(165, 243, 252, 0.65);
	}

	.owned-group-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem;
		border-radius: 9999px;
		border: 1px solid rgba(59, 130, 246, 0.35);
		background: rgba(15, 23, 42, 0.6);
		box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.15);
	}

	.owned-group-toggle button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 9999px;
		padding: 0.45rem 0.95rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: rgba(191, 219, 254, 0.85);
		transition: all 0.2s ease;
		background: transparent;
		border: none;
	}

	.owned-group-toggle button:hover {
		color: rgb(224, 231, 255);
	}

	.owned-group-toggle button.active {
		color: rgb(15, 23, 42);
		background: linear-gradient(120deg, rgba(59, 130, 246, 0.95), rgba(14, 116, 144, 0.95));
		box-shadow: 0 10px 25px rgba(56, 189, 248, 0.35);
	}

	.owned-group-toggle button.active :global(svg) {
		color: rgb(224, 242, 254);
	}

	.owned-group-toggle button :global(svg) {
		width: 1rem;
		height: 1rem;
		color: rgba(191, 219, 254, 0.8);
	}

	.owned-groups {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		margin-top: 1.5rem;
	}

	.owned-groups__empty {
		margin-top: 1rem;
		font-size: 0.9rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.owned-group-card {
		display: grid;
		gap: 0.9rem;
		border-radius: 1.1rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: linear-gradient(165deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.55));
		padding: 1.1rem;
		box-shadow: 0 18px 38px rgba(14, 116, 144, 0.28);
	}

	.owned-group-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.owned-group-card__title {
		display: grid;
		gap: 0.45rem;
	}

	.owned-group-card__badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		padding: 0.35rem 0.85rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: rgb(224, 231, 255);
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.3);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.owned-group-card__badge :global(svg) {
		width: 1rem;
		height: 1rem;
		color: var(--accent, rgba(59, 130, 246, 0.85));
	}

	.owned-group-card__title p {
		font-size: 0.85rem;
		color: rgba(191, 219, 254, 0.75);
	}

	.owned-group-card__stat {
		display: grid;
		justify-items: end;
		gap: 0.15rem;
	}

	.owned-group-card__count {
		font-size: 1.75rem;
		font-weight: 600;
		color: rgb(224, 231, 255);
		text-shadow: 0 12px 25px rgba(59, 130, 246, 0.35);
	}

	.owned-group-card__share {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.owned-group-card__meter {
		position: relative;
		height: 0.45rem;
		border-radius: 9999px;
		background: rgba(30, 41, 59, 0.85);
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.owned-group-card__meter::after {
		content: '';
		position: absolute;
		inset: 0;
		width: calc(var(--owned-share) * 1%);
		background: linear-gradient(120deg, rgba(56, 189, 248, 0.4), var(--owned-accent));
		box-shadow: 0 12px 28px rgba(56, 189, 248, 0.35);
	}

	.owned-group-card__highlight {
		font-size: 0.8rem;
		color: rgba(165, 243, 252, 0.85);
	}

	.owned-group-list {
		display: grid;
		gap: 0.65rem;
	}

	.owned-group-list li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.55);
		padding: 0.7rem 0.85rem;
	}

	.owned-group-list__more {
		justify-content: center;
		font-size: 0.78rem;
		font-style: italic;
		color: rgba(148, 163, 184, 0.75);
	}

	.owned-lab__info {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
	}

	.owned-lab__name {
		display: block;
		font-size: 0.92rem;
		font-weight: 600;
		color: rgb(226, 232, 240);
	}

	.owned-lab__meta {
		display: block;
		font-size: 0.78rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.owned-lab__date {
		align-self: center;
		font-size: 0.75rem;
		color: rgba(129, 140, 248, 0.85);
		white-space: nowrap;
	}

	.timeline-shell {
		position: relative;
		width: 100%;
		overflow-x: auto;
		border-radius: 1.75rem;
		border: 1px solid rgba(217, 70, 239, 0.35);
		background: rgba(12, 5, 32, 0.75);
		padding: 1.25rem;
		box-shadow: 0 28px 60px rgba(74, 23, 116, 0.55);
		backdrop-filter: blur(18px);
	}

	.timeline-glow {
		position: absolute;
		inset: 0;
		border-radius: 1.75rem;
		background:
			radial-gradient(circle at 15% 20%, rgba(217, 70, 239, 0.32), transparent 55%),
			radial-gradient(circle at 80% 30%, rgba(129, 140, 248, 0.25), transparent 50%),
			radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.25), transparent 55%);
		pointer-events: none;
	}

	.timeline-canvas {
		position: relative;
		width: 100%;
		min-width: 100%;
		height: auto;
	}

	.event-icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.7);
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.65);
		outline: 1px solid rgba(255, 255, 255, 0.18);
	}

	.event-icon-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(1.05) contrast(1.05);
	}

	.event-icon-wrapper img.focused {
		outline: 2px solid rgba(217, 70, 239, 0.8);
	}

	.focus-panel {
		border: 1px solid rgba(217, 70, 239, 0.28);
		background: linear-gradient(160deg, rgba(126, 34, 206, 0.22), rgba(15, 23, 42, 0.75));
		box-shadow: 0 25px 55px rgba(74, 23, 116, 0.45);
	}

	@media (max-width: 720px) {
		.hero-content {
			grid-template-columns: 1fr;
		}

		.hero-actions {
			justify-content: center;
		}

		.hero-icon {
			width: 3rem;
			height: 3rem;
		}

		.date-selector {
			flex-direction: column;
			align-items: flex-start;
		}

		.date-selector__clear {
			margin-left: 0;
		}

		.owned-groups {
			grid-template-columns: 1fr;
		}
	}
</style>
