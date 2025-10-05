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
			<div class="flex items-center gap-2 text-sm font-medium tracking-wide text-sky-300 uppercase">
				<Sparkles class="h-4 w-4" /> Signal Boost
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
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
				<Activity size={18} class="text-sky-400" />
				<span>Pulse by Day</span>
			</div>
			<div class="date-selector__chips">
				{#each uniqueDays.slice(0, 6) as day}
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

	{#if timelineEvents.length === 0}
		<div
			class="glass-surface border border-dashed border-sky-400/25 p-10 text-center text-slate-300"
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
			<NotebookPen size={24} class="text-emerald-400" />
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
		border: 1px solid rgba(56, 189, 248, 0.25);
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(2, 132, 199, 0.25));
		box-shadow: 0 25px 55px rgba(8, 47, 73, 0.65);
	}

	.hero-backdrop {
		position: absolute;
		inset: -20% -10%;
		background:
			radial-gradient(circle at 20% 15%, rgba(56, 189, 248, 0.3), transparent 55%),
			radial-gradient(circle at 75% 40%, rgba(129, 140, 248, 0.25), transparent 60%),
			radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.35), transparent 65%);
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
		background: rgba(14, 165, 233, 0.2);
		border: 1px solid rgba(56, 189, 248, 0.45);
		color: rgb(224, 242, 254);
		box-shadow: 0 10px 30px rgba(14, 165, 233, 0.35);
	}

	.hero-eyebrow {
		font-size: 0.8rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgba(165, 243, 252, 0.85);
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
		border: 1px solid rgba(16, 185, 129, 0.5);
		background: linear-gradient(120deg, rgba(16, 185, 129, 0.28), rgba(14, 165, 233, 0.18));
		padding: 0.35rem 0.9rem;
		color: rgb(209, 250, 229);
		font-size: 0.8rem;
		letter-spacing: 0.05em;
	}

	.metric-tile {
		position: relative;
		border-radius: 1rem;
		border: 1px solid rgba(45, 212, 191, 0.2);
		background: linear-gradient(180deg, rgba(13, 148, 136, 0.18), rgba(2, 6, 23, 0.65));
		padding: 1.15rem;
		box-shadow: inset 0 1px 0 rgba(45, 212, 191, 0.25);
	}

	.metric-label {
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(204, 251, 241, 0.8);
	}

	.metric-value {
		margin-top: 0.75rem;
		display: block;
		font-size: 1.875rem;
		font-weight: 600;
		color: rgb(226, 232, 240);
		text-shadow: 0 8px 20px rgba(13, 148, 136, 0.35);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(51, 65, 85, 0.4);
		background: rgba(2, 6, 23, 0.6);
		padding: 0.25rem 0.75rem;
		box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35);
	}

	.legend-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 9999px;
		background: var(--color, #38bdf8);
		box-shadow: 0 0 14px rgba(56, 189, 248, 0.55);
	}

	.legend-dot.note {
		background: linear-gradient(135deg, #38bdf8, #60a5fa);
		box-shadow: 0 0 14px rgba(96, 165, 250, 0.8);
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
		color: rgba(125, 211, 252, 0.85);
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
		border-color: rgba(56, 189, 248, 0.55);
		color: rgb(224, 242, 254);
	}

	.date-selector button.active {
		border-color: rgba(16, 185, 129, 0.8);
		background: rgba(16, 185, 129, 0.2);
		color: rgb(209, 250, 229);
		box-shadow: 0 8px 22px rgba(16, 185, 129, 0.35);
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

	.timeline-shell {
		position: relative;
		width: 100%;
		overflow-x: auto;
		border-radius: 1.75rem;
		border: 1px solid rgba(56, 189, 248, 0.25);
		background: rgba(2, 6, 23, 0.7);
		padding: 1.25rem;
		box-shadow: 0 28px 60px rgba(8, 47, 73, 0.65);
		backdrop-filter: blur(18px);
	}

	.timeline-glow {
		position: absolute;
		inset: 0;
		border-radius: 1.75rem;
		background:
			radial-gradient(circle at 15% 20%, rgba(14, 165, 233, 0.35), transparent 55%),
			radial-gradient(circle at 80% 30%, rgba(96, 165, 250, 0.25), transparent 50%),
			radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.25), transparent 55%);
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
		outline: 2px solid rgba(52, 211, 153, 0.8);
	}

	.focus-panel {
		border: 1px solid rgba(52, 211, 153, 0.25);
		background: linear-gradient(160deg, rgba(15, 118, 110, 0.22), rgba(15, 23, 42, 0.75));
		box-shadow: 0 25px 55px rgba(6, 95, 70, 0.45);
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
	}
</style>
