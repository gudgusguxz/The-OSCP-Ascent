<script>
	import { labs } from '$lib/stores.js';
	import { preferences } from '$lib/preferencesStore.js';
	import { filterForExamPrep, renderMarkdown } from '$lib/markdown.js';
	import { Search, PenLine, ArrowUpRight } from 'lucide-svelte';

	let query = '';

	const matches = (lab) => {
		if (!query.trim()) return true;
		const term = query.trim().toLowerCase();
		const haystack = [
			lab.name,
			lab.os,
			lab.difficulty,
			...(lab.tags || []),
			...(lab.cves || []),
			...(lab.services || []),
			...(lab.notes || []).map((note) => note.content)
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		return haystack.includes(term);
	};

	const notePreview = (lab) => {
		if (!lab.notes?.length) return '';
		const latest = lab.notes[lab.notes.length - 1];
		const content = $preferences.examPrepMode ? filterForExamPrep(latest.content) : latest.content;
		return renderMarkdown(content).slice(0, 600);
	};
</script>

<svelte:head>
	<title>Hack Ascent HQ — Blog Mode</title>
</svelte:head>

<section class="space-y-6">
	<header class="space-y-2">
		<h1 class="text-3xl font-bold text-slate-100">Blog Mode Writeups</h1>
		<p class="max-w-2xl text-slate-300/80">
			Generate clean writeups for HTB, Proving Grounds, and OSCP labs. Pick a lab to auto-build
			Intro, General Understanding, Walkthrough, and Screenshot sections. Exam Prep Mode removes
			spoiler-heavy sections.
		</p>
	</header>

	<div>
		<label
			class="mb-2 block text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase"
			for="writeup-search">Search writeups</label
		>
		<div class="relative">
			<Search class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
			<input
				id="writeup-search"
				type="search"
				placeholder="Search by name, service, tag, CVE"
				bind:value={query}
				class="input-elevated w-full py-2 pr-4 pl-11"
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
		{#each $labs.filter(matches) as lab (lab.id)}
			<article
				class="glass-surface space-y-3 rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-[0_30px_90px_rgba(168,85,247,0.4)]"
			>
				<header class="flex items-start justify-between gap-4">
					<div>
						<h2 class="text-xl font-semibold text-slate-100">{lab.name}</h2>
						<p class="text-sm text-slate-300/80">{lab.category} • {lab.os}</p>
					</div>
					<span
						class="inline-flex items-center gap-2 rounded-full border border-violet-400/60 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200"
					>
						<PenLine size={14} />
						{(lab.notes || []).length} notes
					</span>
				</header>
				{#if lab.notes?.length}
					<div
						class="prose prose-sm prose-invert prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-code:text-violet-400 max-h-32 max-w-none overflow-hidden"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html notePreview(lab)}
					</div>
				{:else}
					<p class="text-sm text-slate-300/80">
						No notes yet — add content from the dashboard to unlock a writeup.
					</p>
				{/if}
				<footer class="flex justify-end">
					<a
						class="inline-flex items-center gap-2 rounded-xl border border-violet-400/60 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
						href={`/writeups/${lab.id}`}
					>
						Open writeup <ArrowUpRight size={16} />
					</a>
				</footer>
			</article>
		{:else}
			<p class="text-slate-300/80">No labs match your query.</p>
		{/each}
	</div>
</section>
