<script>
	import { page } from '$app/stores';
	import { labs } from '$lib/stores.js';
	import { preferences } from '$lib/preferencesStore.js';
	import { filterForExamPrep, renderMarkdown } from '$lib/markdown.js';
	import { ArrowLeft, Download, ClipboardCopy, ClipboardCheck } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let copied = false;

	$: labId = $page.params.id;
	$: lab = $labs.find((item) => item.id === labId);

	const formatDate = (timestamp) =>
		timestamp
			? new Date(timestamp).toLocaleString([], {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
			: '—';

	const cleanList = (items) => (items && items.length ? items.join(', ') : 'N/A');

	const buildWriteupMarkdown = (lab) => {
		if (!lab) return '';
		const sortedNotes = [...(lab.notes || [])].sort(
			(a, b) => new Date(a.timestamp) - new Date(b.timestamp)
		);
		const stepByStep = sortedNotes
			.map((note) => {
				const content = $preferences.examPrepMode ? filterForExamPrep(note.content) : note.content;
				return `#### ${new Date(note.timestamp).toLocaleString()}\n${content}`;
			})
			.join('\n\n');

		const screenshotLines = [];
		const commandLines = [];

		sortedNotes.forEach((note) => {
			const lines = note.content.split('\n');
			lines.forEach((line) => {
				const trimmed = line.trim();
				if (trimmed.includes('![[')) {
					screenshotLines.push(trimmed);
				}
				if (/^(sudo |# |\$ )/.test(trimmed)) {
					commandLines.push(trimmed);
				}
			});
		});

		const screenshotSection = screenshotLines.length
			? screenshotLines.join('\n')
			: 'No screenshots referenced yet.';
		const commandSection = commandLines.length
			? commandLines.map((line) => `- \`${line}\``).join('\n')
			: '- No commands captured yet.';

		return (
			`# ${lab.name} — Root Quest Writeup\n\n` +
			`## Intro\n` +
			`- **Difficulty:** ${lab.difficulty || 'Unknown'}\n` +
			`- **Operating System:** ${lab.os || 'Unknown'}\n` +
			`- **Source:** ${lab.source?.toUpperCase() || 'N/A'}\n` +
			`- **Category:** ${lab.category || 'N/A'}\n` +
			`- **Services:** ${cleanList(lab.services)}\n` +
			`- **Tags:** ${cleanList(lab.tags)}\n` +
			`- **CVEs:** ${cleanList(lab.cves)}\n\n` +
			`## General Understanding\n` +
			`- Status: ${lab.status || 'unknown'}\n` +
			`- Started: ${formatDate(lab.startedAt)}\n` +
			`- Owned: ${formatDate(lab.completedAt)}\n` +
			`- Notes Captured: ${(lab.notes || []).length}\n\n` +
			`## Step-by-step Walkthrough\n` +
			(stepByStep ||
				'No walkthrough notes yet. Add note entries from the dashboard to build this section.') +
			`\n\n## Screenshots + Commands\n` +
			`${screenshotSection}\n\n### Command Checklist\n${commandSection}\n`
		);
	};

	$: markdownWriteup = buildWriteupMarkdown(lab);
	$: htmlWriteup = markdownWriteup
		? `<article class="writeup">${renderMarkdown(markdownWriteup)}</article>`
		: '';

	async function copyMarkdown() {
		if (!markdownWriteup) return;
		try {
			await navigator.clipboard.writeText(markdownWriteup);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.error('Copy failed', error);
		}
	}

	function exportWriteup(format) {
		if (!markdownWriteup) return;
		const content =
			format === 'html'
				? `<!doctype html><html><head><meta charset="utf-8"><title>${lab.name} — Root Quest Writeup</title></head><body>${htmlWriteup}</body></html>`
				: markdownWriteup;
		const blob = new Blob([content], { type: format === 'html' ? 'text/html' : 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${lab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-writeup.${format === 'html' ? 'html' : 'md'}`;
		link.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		if (!lab) {
			console.warn('Writeup not found, redirecting.');
			goto('/writeups');
		}
	});
</script>

<svelte:head>
	<title>{lab ? `${lab.name} — Root Quest Blog Mode` : 'Writeup not found'}</title>
</svelte:head>

{#if !lab}
	<section class="p-10 text-center text-slate-300/80">
		<p>Writeup not found. Returning to the writeup index…</p>
	</section>
{:else}
	<section class="space-y-6">
		<header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<button
					class="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition-colors hover:text-emerald-100"
					on:click={() => goto('/writeups')}
				>
					<ArrowLeft size={16} /> Back to list
				</button>
				<h1 class="mt-2 text-3xl font-bold text-slate-100">{lab.name}</h1>
				<p class="text-slate-300/80">
					{lab.category} • {lab.os} • {lab.difficulty}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					class="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-[rgba(8,19,38,0.65)] px-3 py-2 text-slate-200 transition-colors hover:border-emerald-400/55 hover:bg-[rgba(16,185,129,0.16)] hover:text-emerald-200"
					on:click={copyMarkdown}
				>
					{#if copied}
						<ClipboardCheck size={16} /> Copied!
					{:else}
						<ClipboardCopy size={16} /> Copy Markdown
					{/if}
				</button>
				<button
					class="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-[rgba(8,19,38,0.65)] px-3 py-2 text-slate-200 transition-colors hover:border-emerald-400/55 hover:bg-[rgba(16,185,129,0.16)] hover:text-emerald-200"
					on:click={() => exportWriteup('markdown')}
				>
					<Download size={16} /> Export .md
				</button>
				<button
					class="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-[rgba(8,19,38,0.65)] px-3 py-2 text-slate-200 transition-colors hover:border-sky-400/55 hover:bg-[rgba(56,189,248,0.18)] hover:text-sky-200"
					on:click={() => exportWriteup('html')}
				>
					<Download size={16} /> Export .html
				</button>
			</div>
		</header>

		<section class="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
			<aside class="glass-surface space-y-3 rounded-2xl p-5">
				<h2 class="text-lg font-semibold text-slate-100">Lab Snapshot</h2>
				<dl class="space-y-2 text-sm text-slate-300/80">
					<div class="flex justify-between">
						<dt>Status</dt>
						<dd>{lab.status}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Started</dt>
						<dd>{formatDate(lab.startedAt)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Owned</dt>
						<dd>{formatDate(lab.completedAt)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Services</dt>
						<dd>{cleanList(lab.services)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Tags</dt>
						<dd>{cleanList(lab.tags)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>CVEs</dt>
						<dd>{cleanList(lab.cves)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Notes</dt>
						<dd>{(lab.notes || []).length}</dd>
					</div>
				</dl>
			</aside>

			<article class="glass-surface space-y-4 rounded-2xl p-6">
				<h2 class="text-lg font-semibold text-slate-100">Markdown Source</h2>
				<textarea class="input-elevated h-64 w-full rounded-xl px-3 py-3 font-mono text-sm" readonly
					>{markdownWriteup}</textarea
				>
				<h2 class="text-lg font-semibold text-slate-100">Preview</h2>
				<div
					class="prose prose-base prose-invert prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-code:text-emerald-400 max-w-none"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html renderMarkdown(markdownWriteup)}
				</div>
			</article>
		</section>
	</section>
{/if}
