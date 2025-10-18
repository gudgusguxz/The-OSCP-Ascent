<script>
	import { onMount } from 'svelte';

	const providers = ['HTB', 'PG', 'OSCP', 'TryHackMe', 'PentesterLab'];
	const operatingSystems = ['Linux', 'Windows'];
	const difficulties = ['Easy', 'Medium', 'Hard', 'Insane'];
	const focusAreas = ['Enumeration', 'Privilege Escalation', 'Web', 'Active Directory'];
	const statuses = ['Not Started', 'In Progress', 'Completed'];

	const baseColumns = [
		{ key: 'name', label: 'Lab', width: 'w-64' },
		{ key: 'provider', label: 'Provider', width: 'w-32' },
		{ key: 'difficulty', label: 'Difficulty', width: 'w-28' },
		{ key: 'operatingSystem', label: 'OS', width: 'w-24' },
		{ key: 'status', label: 'Status', width: 'w-32' },
		{ key: 'completedAt', label: 'Completed', width: 'w-36' },
		{ key: 'lastTouchedAt', label: 'Last Touch', width: 'w-36' },
		{ key: 'notes', label: 'Notes', width: 'w-80' }
	];

	const randomChoice = (list) => list[Math.floor(Math.random() * list.length)];
	const randomDateWithin = (daysBack = 120) => {
		const now = new Date();
		const past = new Date(now);
		past.setDate(now.getDate() - Math.floor(Math.random() * daysBack));
		return past;
	};

	const formatDate = (date) => {
		if (!date) return '—';
		const d = new Date(date);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	};

	const numberFormatter = new Intl.NumberFormat();

	const generateMockLabs = () => {
		return Array.from({ length: 2000 }).map((_, index) => {
			const difficulty = randomChoice(difficulties);
			const status = randomChoice(statuses);
			const completedAt = status === 'Completed' ? randomDateWithin() : null;
			const lastTouchedAt = randomDateWithin();
			const os = randomChoice(operatingSystems);
			return {
				id: `lab-${index + 1}`,
				name: `Virtual Lab ${index + 1}`,
				provider: randomChoice(providers),
				difficulty,
				operatingSystem: os,
				focus: randomChoice(focusAreas),
				status,
				completedAt,
				lastTouchedAt,
				hasWriteup: Math.random() > 0.6,
				flagged: difficulty === 'Insane' || (status === 'In Progress' && Math.random() > 0.7),
				notes: `Key takeaways for scenario #${index + 1}`,
				rating: (Math.random() * 5).toFixed(1),
				attackSurface: Math.random() > 0.5 ? 'Hybrid' : 'Traditional'
			};
		});
	};

	let loading = true;
	let labs = [];
	let currentLabId = null;
	let selectedColumns = baseColumns.map((col) => col.key);
	let columnPickerOpen = false;
	let visibleColumns = [];
	let groupByField = '';
	let savedViews = [];
	let newViewName = '';
	let searchText = '';
	let sortConfig = { key: 'name', direction: 'asc' };
	let highlightRules = [
		{ field: 'difficulty', equals: 'Insane', color: 'border-rose-500/60 bg-rose-500/10' },
		{ field: 'status', equals: 'Completed', color: 'border-emerald-500/60 bg-emerald-500/10' }
	];

	let customFields = [];
	let newCustomFieldName = '';
	let customFieldValue = '';

	let activeFilters = {
		provider: new Set(),
		difficulty: new Set(),
		status: new Set()
	};

	let timelineView = 'provider';
	let filterDateChips = [
		{ label: 'Last 7 days', value: '7' },
		{ label: 'Last 30 days', value: '30' },
		{ label: 'Last 90 days', value: '90' },
		{ label: 'This year', value: '365' },
		{ label: 'All time', value: 'all' }
	];
	let activeDateChip = '30';

	let viewportHeight = 680;
	let scrollTop = 0;
	const rowHeight = 68;
	const overscan = 10;
	let viewportRef;

	const filterLabs = (items) => {
		return items.filter((lab) => {
			if (searchText?.trim()) {
				const normalized = searchText.trim().toLowerCase();
				const candidate =
					`${lab.name} ${lab.provider} ${lab.difficulty} ${lab.operatingSystem} ${lab.status} ${lab.focus}`.toLowerCase();
				if (!candidate.includes(normalized)) return false;
			}

			if (activeFilters.provider.size && !activeFilters.provider.has(lab.provider)) {
				return false;
			}
			if (activeFilters.difficulty.size && !activeFilters.difficulty.has(lab.difficulty)) {
				return false;
			}
			if (activeFilters.status.size && !activeFilters.status.has(lab.status)) {
				return false;
			}

			if (activeDateChip !== 'all') {
				const days = Number(activeDateChip);
				const cutoff = new Date();
				cutoff.setDate(cutoff.getDate() - days);
				if (lab.lastTouchedAt < cutoff) {
					return false;
				}
			}

			return true;
		});
	};

	const sortLabs = (items) => {
		const { key, direction } = sortConfig;
		if (!key) return items;
		return [...items].sort((a, b) => {
			const aValue = a[key];
			const bValue = b[key];
			if (aValue == null && bValue == null) return 0;
			if (aValue == null) return direction === 'asc' ? -1 : 1;
			if (bValue == null) return direction === 'asc' ? 1 : -1;
			if (typeof aValue === 'number' && typeof bValue === 'number') {
				return direction === 'asc' ? aValue - bValue : bValue - aValue;
			}
			const normalizedA = String(aValue).toLowerCase();
			const normalizedB = String(bValue).toLowerCase();
			if (normalizedA === normalizedB) return 0;
			if (normalizedA < normalizedB) return direction === 'asc' ? -1 : 1;
			return direction === 'asc' ? 1 : -1;
		});
	};

	const groupByLabs = (items) => {
		if (!groupByField) {
			return items.map((row) => ({ type: 'lab', data: row }));
		}

		const grouped = items.reduce((acc, lab) => {
			const key = lab[groupByField] ?? 'Unassigned';
			if (!acc[key]) acc[key] = [];
			acc[key].push(lab);
			return acc;
		}, {});

		const orderedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
		const rows = [];
		orderedKeys.forEach((key) => {
			rows.push({ type: 'group', key, count: grouped[key].length });
			grouped[key].forEach((lab) => rows.push({ type: 'lab', data: lab }));
		});
		return rows;
	};

	const columnWidthClass = (column) => column.width ?? 'min-w-[10rem]';

	const toggleFilter = (type, value) => {
		const next = new Set(activeFilters[type]);
		if (next.has(value)) {
			next.delete(value);
		} else {
			next.add(value);
		}
		activeFilters = { ...activeFilters, [type]: next };
	};

	const toggleColumn = (columnKey) => {
		if (selectedColumns.includes(columnKey)) {
			selectedColumns = selectedColumns.filter((key) => key !== columnKey);
		} else {
			selectedColumns = [...selectedColumns, columnKey];
		}
	};

	const toggleSort = (columnKey) => {
		if (sortConfig.key === columnKey) {
			sortConfig = {
				key: columnKey,
				direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
			};
		} else {
			sortConfig = { key: columnKey, direction: 'asc' };
		}
	};

	const saveView = () => {
		if (!newViewName.trim()) return;
		const payload = {
			name: newViewName.trim(),
			filters: {
				provider: Array.from(activeFilters.provider),
				difficulty: Array.from(activeFilters.difficulty),
				status: Array.from(activeFilters.status)
			},
			groupBy: groupByField,
			sort: sortConfig,
			columns: [...selectedColumns]
		};
		savedViews = [...savedViews.filter((view) => view.name !== payload.name), payload];
		newViewName = '';
	};

	const applySavedView = (view) => {
		activeFilters = {
			provider: new Set(view.filters.provider),
			difficulty: new Set(view.filters.difficulty),
			status: new Set(view.filters.status)
		};
		groupByField = view.groupBy;
		sortConfig = view.sort;
		selectedColumns = [...view.columns];
	};

	const exportData = (format) => {
		const filtered = groupedRows.filter((row) => row.type === 'lab').map((row) => row.data);
		const columnsForExport = visibleColumns.length
			? visibleColumns
			: [
					...baseColumns.filter((column) => selectedColumns.includes(column.key)),
					...customFields.filter((field) => selectedColumns.includes(field.key))
				];
		if (format === 'csv') {
			const headers = columnsForExport.map((column) => column.label);
			const keys = columnsForExport.map((column) => column.key);
			const lines = [headers.join(',')];
			filtered.forEach((lab) => {
				const row = keys
					.map((key) => {
						const value = lab[key];
						if (value == null) return '';
						const normalized = typeof value === 'string' ? value.replace(/"/g, '""') : value;
						return `"${normalized}"`;
					})
					.join(',');
				lines.push(row);
			});
			const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'labs.csv';
			a.click();
			URL.revokeObjectURL(url);
		} else {
			const blob = new Blob([JSON.stringify(filtered, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'labs.json';
			a.click();
			URL.revokeObjectURL(url);
		}
	};

	const addCustomField = () => {
		const trimmed = newCustomFieldName.trim();
		if (!trimmed) return;
		const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const field = {
			key,
			label: trimmed,
			width: 'w-36',
			generator: customFieldValue?.trim() ? customFieldValue.trim() : null
		};
		customFields = [...customFields.filter((item) => item.key !== key), field];
		selectedColumns = [...selectedColumns, key];
		labs = labs.map((lab) => ({
			...lab,
			[key]: field.generator ? `${field.generator} ${Math.ceil(Math.random() * 100)}` : ''
		}));
		newCustomFieldName = '';
		customFieldValue = '';
	};

	const addHighlightRule = (field, equals, color) => {
		highlightRules = [...highlightRules, { field, equals, color }];
	};

	const setCurrentLab = (lab) => {
		currentLabId = lab?.id ?? null;
	};

	const timelineMetrics = (items, view) => {
		if (!items.length) return [];
		const grouping = items.reduce((acc, lab) => {
			const key = lab[view] ?? 'Unspecified';
			acc[key] = (acc[key] || 0) + 1;
			return acc;
		}, {});

		const [focusKey] = Object.entries(grouping).sort((a, b) => b[1] - a[1])[0] ?? [];
		const scopedItems = focusKey
			? items.filter((lab) => (lab[view] ?? 'Unspecified') === focusKey)
			: items;

		const buckets = scopedItems.reduce((acc, lab) => {
			const dateKey = new Date(lab.lastTouchedAt).toISOString().slice(0, 10);
			acc[dateKey] = (acc[dateKey] || 0) + 1;
			return acc;
		}, {});

		return Object.entries(buckets)
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.slice(-14)
			.map(([date, count]) => ({ date, count, focusKey: focusKey ?? 'All labs' }));
	};

	const graphsByProvider = (items) => {
		const totals = providers.reduce((acc, provider) => {
			acc[provider] = 0;
			return acc;
		}, {});
		items.forEach((lab) => {
			totals[lab.provider] = (totals[lab.provider] || 0) + 1;
		});
		return Object.entries(totals).map(([provider, count]) => ({ provider, count }));
	};

	const getHighlightForLab = (lab) => {
		const rule = highlightRules.find((item) => lab[item.field] === item.equals);
		return rule ? rule.color : '';
	};

	const onScroll = (event) => {
		scrollTop = event.target.scrollTop;
		viewportHeight = event.target.clientHeight;
	};

	const updateViewportHeight = () => {
		if (viewportRef) {
			viewportHeight = viewportRef.clientHeight;
		}
	};

	$: filteredLabs = filterLabs(labs);
	$: sortedLabs = sortLabs(filteredLabs);
	$: groupedRows = groupByLabs(sortedLabs);
	$: totalHeight = groupedRows.length * rowHeight;
	$: startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
	$: endIndex = Math.min(
		groupedRows.length,
		Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan
	);
	$: visibleRows = groupedRows.slice(startIndex, endIndex);
	$: offsetTop = startIndex * rowHeight;

	$: visibleColumns = [
		...baseColumns.filter((column) => selectedColumns.includes(column.key)),
		...customFields.filter((field) => selectedColumns.includes(field.key))
	];

	$: totals = {
		totalLabs: filteredLabs.length,
		completed: filteredLabs.filter((lab) => lab.status === 'Completed').length,
		inProgress: filteredLabs.filter((lab) => lab.status === 'In Progress').length,
		insane: filteredLabs.filter((lab) => lab.difficulty === 'Insane').length
	};

	$: providerStats = graphsByProvider(filteredLabs);

	onMount(() => {
		labs = generateMockLabs();
		const timer = setTimeout(() => {
			loading = false;
			updateViewportHeight();
		}, 600);
		window.addEventListener('resize', updateViewportHeight);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('resize', updateViewportHeight);
		};
	});
</script>

<svelte:window on:resize={updateViewportHeight} />

<div class="min-h-screen bg-slate-950 text-slate-100">
	<div class="mx-auto max-w-7xl px-6 py-12">
		<div class="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-sm tracking-wider text-slate-400 uppercase">Timeline &amp; Graphs</p>
				<h1 class="text-3xl font-semibold text-white md:text-4xl">Labs Intelligence Center</h1>
				<p class="mt-2 max-w-2xl text-sm text-slate-400">
					Explore completion timelines, vendor coverage, and operational velocity across the full
					lab fleet. Adjust filters, save perspectives, and export curated views for your reporting
					cadence.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div
					class="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-sm shadow-inner shadow-slate-900"
				>
					<span class="text-slate-400">Timeline by</span>
					<select
						class="bg-transparent text-slate-100 focus:outline-none"
						bind:value={timelineView}
					>
						<option value="provider">Provider</option>
						<option value="status">Status</option>
						<option value="difficulty">Difficulty</option>
					</select>
				</div>
				<button
					class="rounded-lg border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-violet-500/70 hover:bg-violet-500/10"
					on:click={() => exportData('csv')}
				>
					Export CSV
				</button>
				<button
					class="rounded-lg border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-violet-500/70 hover:bg-violet-500/10"
					on:click={() => exportData('json')}
				>
					Export JSON
				</button>
			</div>
		</div>

		<div class="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
			<div
				class="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-xl"
			>
				<p class="text-sm text-slate-400">Total Labs</p>
				<p class="mt-3 text-4xl font-semibold text-white">
					{numberFormatter.format(totals.totalLabs)}
				</p>
				<p class="mt-2 text-xs text-slate-500">All labs matching current filters</p>
			</div>
			<div
				class="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-6 shadow-xl"
			>
				<p class="text-sm text-emerald-300">Completed</p>
				<p class="mt-3 text-4xl font-semibold text-emerald-200">
					{numberFormatter.format(totals.completed)}
				</p>
				<p class="mt-2 text-xs text-emerald-400/80">Operational wins delivered</p>
			</div>
			<div
				class="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-6 shadow-xl"
			>
				<p class="text-sm text-amber-300">In Progress</p>
				<p class="mt-3 text-4xl font-semibold text-amber-200">
					{numberFormatter.format(totals.inProgress)}
				</p>
				<p class="mt-2 text-xs text-amber-400/80">Active engagements right now</p>
			</div>
			<div
				class="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-rose-500/10 via-slate-900 to-slate-950 p-6 shadow-xl xl:col-span-3"
			>
				<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
					<div>
						<p class="text-sm text-rose-300">High Difficulty</p>
						<p class="mt-3 text-4xl font-semibold text-rose-200">
							{numberFormatter.format(totals.insane)}
						</p>
						<p class="mt-2 text-xs text-rose-200/70">Labs flagged as Insane difficulty</p>
					</div>
					<div class="flex flex-1 flex-col">
						<div class="flex items-center justify-between text-xs text-slate-400">
							<span>Coverage</span>
							<span>{Math.round((totals.completed / Math.max(1, totals.totalLabs)) * 100)}%</span>
						</div>
						<div class="mt-2 h-2 rounded-full bg-slate-800">
							<div
								class="h-2 rounded-full bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-400"
								style={`width: ${Math.min(100, Math.round((totals.completed / Math.max(1, totals.totalLabs)) * 100))}%`}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="mb-8 flex flex-col gap-6 lg:flex-row">
			{@const timelinePoints = timelineMetrics(filteredLabs, timelineView)}
			{@const timelineFocus = timelinePoints[0]?.focusKey ?? 'All labs'}
			<div class="flex-1 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-xl">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-white">Velocity Timeline</h2>
						<p class="text-xs text-slate-500">
							{timelinePoints.length} active days • Focus: {timelineFocus}
						</p>
					</div>
					<div class="flex gap-3 overflow-x-auto text-xs whitespace-nowrap text-slate-300">
						<div class="flex snap-x gap-2 overflow-x-auto pb-1">
							{#each filterDateChips as chip (chip.value)}
								<button
									class={`snap-center rounded-full border px-3 py-1 transition ${
										activeDateChip === chip.value
											? 'border-violet-500/70 bg-violet-500/10 text-violet-200'
											: 'border-slate-700/70 bg-slate-900/70 text-slate-400'
									}`}
									on:click={() => (activeDateChip = chip.value)}
								>
									{chip.label}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div
					class="mt-6 h-48 rounded-xl border border-slate-800/70 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-4"
				>
					{#if timelinePoints.length === 0}
						<div class="flex h-full items-center justify-center text-sm text-slate-500">
							No activity in selected window
						</div>
					{:else}
						<svg viewBox="0 0 400 160" preserveAspectRatio="none" class="h-full w-full">
							<defs>
								<linearGradient id="timelineGradient" x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stop-color="rgba(139, 92, 246, 0.8)" />
									<stop offset="100%" stop-color="rgba(56, 189, 248, 0.1)" />
								</linearGradient>
							</defs>
							{#if timelinePoints.length > 1}
								{#key timelinePoints.length}
									<polyline
										fill="none"
										stroke="url(#timelineGradient)"
										stroke-width="4"
										points={timelinePoints
											.map(({ count }, index) => {
												const x = (index / (timelinePoints.length - 1)) * 400;
												const y = 160 - Math.min(140, count * 18);
												return `${x},${y}`;
											})
											.join(' ')}
									/>
								{/key}
							{/if}
							{#each timelinePoints as point, index (point.date)}
								{#if timelinePoints.length > 1}
									<circle
										cx={(index / (timelinePoints.length - 1)) * 400}
										cy={160 - Math.min(140, point.count * 18)}
										r="6"
										fill="rgba(139, 92, 246, 0.9)"
										stroke="rgba(59, 130, 246, 0.6)"
									/>
								{/if}
								<text
									x={(index / Math.max(1, timelinePoints.length - 1)) * 400}
									y="150"
									text-anchor="middle"
									class="fill-slate-500 text-[10px]"
								>
									{new Date(point.date).toLocaleDateString(undefined, {
										month: 'short',
										day: 'numeric'
									})}
								</text>
								<text
									x={(index / Math.max(1, timelinePoints.length - 1)) * 400}
									y={160 - Math.min(140, point.count * 18) - 10}
									text-anchor="middle"
									class="fill-slate-300 text-[10px]"
								>
									{point.count}
								</text>
							{/each}
						</svg>
					{/if}
				</div>
			</div>
			<div
				class="w-full rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-xl lg:w-96"
			>
				<h2 class="text-lg font-semibold text-white">Provider Mix</h2>
				<p class="text-xs text-slate-500">Labs grouped by vendor</p>
				<div class="mt-6 space-y-4">
					{#each providerStats as stat (stat.provider)}
						<div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-slate-300">{stat.provider}</span>
								<span class="font-semibold text-slate-100">{stat.count}</span>
							</div>
							<div class="mt-2 h-2 rounded-full bg-slate-800">
								<div
									class="h-2 rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500"
									style={`width: ${Math.min(100, (stat.count / Math.max(1, totals.totalLabs)) * 100)}%`}
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div
			class="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-xl"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex flex-wrap items-center gap-3">
					<div
						class="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-xs"
					>
						<span class="text-slate-400">Group by</span>
						<select
							class="bg-transparent text-slate-100 focus:outline-none"
							bind:value={groupByField}
						>
							<option value="">None</option>
							<option value="provider">Provider</option>
							<option value="difficulty">Difficulty</option>
							<option value="status">Status</option>
							<option value="operatingSystem">Operating System</option>
						</select>
					</div>
					<div class="relative">
						<button
							class="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-200 hover:border-violet-500/70 hover:bg-violet-500/10"
							on:click={() => (columnPickerOpen = !columnPickerOpen)}
						>
							Column Picker
						</button>
						{#if columnPickerOpen}
							<div
								class="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-slate-800/80 bg-slate-950/95 p-4 text-sm shadow-xl"
							>
								<p class="text-xs tracking-wider text-slate-500 uppercase">Columns</p>
								<div class="mt-3 space-y-2">
									{#each [...baseColumns, ...customFields] as column (column.key)}
										<label class="flex items-center justify-between gap-3 text-xs text-slate-300">
											<span>{column.label}</span>
											<input
												type="checkbox"
												class="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500"
												checked={selectedColumns.includes(column.key)}
												on:change={() => toggleColumn(column.key)}
											/>
										</label>
									{/each}
								</div>
							</div>
						{/if}
					</div>
					<div
						class="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-xs"
					>
						<input
							type="text"
							placeholder="Search labs..."
							bind:value={searchText}
							class="w-48 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-3 text-xs text-slate-300">
					<div class="flex items-center gap-2">
						<input
							class="h-8 w-32 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-slate-100 focus:outline-none"
							placeholder="Save view as..."
							bind:value={newViewName}
						/>
						<button
							class="rounded-lg border border-violet-500/70 bg-violet-500/10 px-3 py-2 font-semibold text-violet-200 hover:bg-violet-500/20"
							on:click={saveView}
						>
							Save view
						</button>
					</div>
					{#if savedViews.length}
						<div class="flex items-center gap-2">
							<span class="text-slate-500">Saved</span>
							<div class="flex gap-2">
								{#each savedViews as view (view.name)}
									<button
										class="rounded-full border border-slate-700/70 px-3 py-1 text-xs text-slate-300 hover:border-violet-500/70 hover:bg-violet-500/10"
										on:click={() => applySavedView(view)}
									>
										{view.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
			<div class="flex flex-wrap gap-2 text-xs">
				{#each providers as provider (provider)}
					<button
						class={`rounded-full border px-3 py-1 transition ${
							activeFilters.provider.has(provider)
								? 'border-sky-500/70 bg-sky-500/10 text-sky-200'
								: 'border-slate-700/70 bg-slate-900/60 text-slate-400'
						}`}
						on:click={() => toggleFilter('provider', provider)}
					>
						{provider}
					</button>
				{/each}
				{#each difficulties as difficulty (difficulty)}
					<button
						class={`rounded-full border px-3 py-1 transition ${
							activeFilters.difficulty.has(difficulty)
								? 'border-amber-500/70 bg-amber-500/10 text-amber-200'
								: 'border-slate-700/70 bg-slate-900/60 text-slate-400'
						}`}
						on:click={() => toggleFilter('difficulty', difficulty)}
					>
						{difficulty}
					</button>
				{/each}
				{#each statuses as status (status)}
					<button
						class={`rounded-full border px-3 py-1 transition ${
							activeFilters.status.has(status)
								? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
								: 'border-slate-700/70 bg-slate-900/60 text-slate-400'
						}`}
						on:click={() => toggleFilter('status', status)}
					>
						{status}
					</button>
				{/each}
			</div>
		</div>

		<div class="mb-8 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-xl">
			<h2 class="text-lg font-semibold text-white">Highlighting &amp; Custom Fields</h2>
			<div class="mt-4 grid gap-6 md:grid-cols-2">
				<div class="space-y-4">
					<div class="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4">
						<h3 class="text-sm font-semibold text-slate-100">Custom field</h3>
						<div class="mt-3 flex flex-col gap-3 text-xs">
							<input
								class="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-slate-100 focus:outline-none"
								placeholder="Field name"
								bind:value={newCustomFieldName}
							/>
							<input
								class="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-slate-100 focus:outline-none"
								placeholder="Value prefix (optional)"
								bind:value={customFieldValue}
							/>
							<button
								class="self-start rounded-lg border border-sky-500/60 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
								on:click={addCustomField}
							>
								Add field
							</button>
						</div>
					</div>
				</div>
				<div class="space-y-4">
					<div class="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4">
						<h3 class="text-sm font-semibold text-slate-100">Highlight rules</h3>
						<ul class="mt-3 space-y-2 text-xs text-slate-300">
							{#each highlightRules as rule, index (rule.field + String(rule.equals) + index)}
								<li
									class="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2"
								>
									<span>{rule.field} → {rule.equals}</span>
									<span
										class={`rounded-full border px-2 py-1 text-[10px] text-slate-200 ${rule.color}`}
									>
										{rule.color}
									</span>
								</li>
							{/each}
						</ul>
						<div class="mt-4 flex flex-wrap gap-2 text-xs">
							<button
								class="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-rose-200"
								on:click={() =>
									addHighlightRule('status', 'In Progress', 'border-amber-500/60 bg-amber-500/10')}
							>
								Flag in progress
							</button>
							<button
								class="rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-emerald-200"
								on:click={() =>
									addHighlightRule('hasWriteup', true, 'border-emerald-500/60 bg-emerald-500/10')}
							>
								Highlight writeups
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-xl">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold text-white">Virtualized Lab Table</h2>
				<p class="text-xs text-slate-500">
					{filteredLabs.length} labs shown • {visibleColumns.length} columns selected
				</p>
			</div>

			<div class="mt-4 overflow-hidden rounded-xl border border-slate-800/80">
				{#if loading}
					<div class="space-y-3 p-6">
						{#each Array.from({ length: 8 }, (_, idx) => idx) as skeletonIndex (skeletonIndex)}
							<div class="h-14 animate-pulse rounded-lg bg-slate-800/60" />
						{/each}
					</div>
				{:else}
					<div class="overflow-x-auto">
						<div class="min-w-max">
							<div class="overflow-hidden bg-slate-900/80">
								<div class="flex">
									{#each visibleColumns as column (column.key)}
										<button
											class={`flex flex-shrink-0 items-center gap-2 border-r border-slate-800/60 px-4 py-3 text-left text-xs tracking-wide text-slate-400 uppercase ${columnWidthClass(column)}`}
											on:click={() => toggleSort(column.key)}
										>
											{column.label}
											{#if sortConfig.key === column.key}
												<span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
											{/if}
										</button>
									{/each}
								</div>
							</div>
							<div
								class="relative h-[680px] overflow-y-auto bg-slate-950/60"
								bind:this={viewportRef}
								on:scroll={onScroll}
							>
								<div style={`height: ${totalHeight}px; position: relative;`}>
									<div style={`transform: translateY(${offsetTop}px);`}>
										{#each visibleRows as row (row.type === 'group' ? `group-${row.key}` : row.data.id)}
											{#if row.type === 'group'}
												<div
													class="flex items-center gap-3 border-b border-slate-900/80 bg-slate-900/80 px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
													style={`height: ${rowHeight}px;`}
												>
													<span class="text-violet-300">{row.key}</span>
													<span
														class="rounded-full border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-400"
														>{row.count}</span
													>
												</div>
											{:else}
												<div
													class={`flex border-b border-slate-900/60 text-sm transition hover:bg-slate-900/60 ${getHighlightForLab(row.data)}`}
													style={`height: ${rowHeight}px;`}
													on:mouseenter={() => setCurrentLab(row.data)}
													on:click={() => setCurrentLab(row.data)}
												>
													{#each visibleColumns as column (column.key)}
														<div
															class={`flex flex-shrink-0 items-center px-4 text-slate-200 ${columnWidthClass(column)}`}
														>
															{#if column.key === 'completedAt' || column.key === 'lastTouchedAt'}
																<span class="text-xs text-slate-400"
																	>{formatDate(row.data[column.key])}</span
																>
															{:else if column.key === 'notes'}
																<span class="line-clamp-2 text-xs text-slate-300"
																	>{row.data[column.key]}</span
																>
															{:else if column.key === 'hasWriteup'}
																<span class="text-xs">{row.data[column.key] ? 'Yes' : 'No'}</span>
															{:else}
																<span class="text-xs text-slate-200"
																	>{row.data[column.key] ?? ''}</span
																>
															{/if}
														</div>
													{/each}
												</div>
											{/if}
										{/each}
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
			{#if currentLabId}
				<div
					class="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-300"
				>
					<p>
						<span class="font-semibold text-violet-200">Current focus:</span>
						{labs.find((lab) => lab.id === currentLabId)?.name}
					</p>
					<p class="mt-1 text-slate-500">
						Grouped by {groupByField || 'None'} • Sorted by {sortConfig.key} ({sortConfig.direction})
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
