<script>
	import '../app.css';
	import {
		RotateCw,
		MoonStar,
		Sun,
		LayoutDashboard,
		LineChart,
		NotebookPen,
		Upload,
		Download
	} from 'lucide-svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import clsx from 'clsx';

	import { preferences, toggleTheme } from '$lib/preferencesStore.js';
	import { labs, normalizeLabsCollection } from '$lib/stores.js';

	let filePicker;

	const navLinks = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/stats', label: 'Timeline & Graphs', icon: LineChart },
		{ href: '/writeups', label: 'Blog Mode', icon: NotebookPen }
	];

	function resetData() {
		if (confirm('Are you sure you want to reset all data?')) {
			localStorage.removeItem('my-advanced-labs');
			window.location.reload();
		}
	}

	function toggleDarkMode() {
		toggleTheme();
	}

	function toggleExamPrepMode() {
		preferences.update((current) => ({ ...current, examPrepMode: !current.examPrepMode }));
	}

	function exportBackup() {
		const data = JSON.stringify(get(labs), null, 2);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `rootquest-backup-${new Date().toISOString().split('T')[0]}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function triggerImport() {
		filePicker?.click();
	}

	async function importBackup(event) {
		const file = event?.target?.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const payload = JSON.parse(text);
			labs.set(normalizeLabsCollection(payload));
			alert('Backup imported successfully.');
		} catch (error) {
			console.error('Failed to import backup', error);
			alert('Import failed. Ensure the file is a valid Root Quest backup.');
		} finally {
			event.target.value = '';
		}
	}

	function navigateTo(path) {
		goto(path);
	}
</script>

<div
	class="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100"
>
	<div class="container mx-auto flex w-full flex-grow flex-col p-4 md:p-8">
		<header
			class="mb-8 flex flex-col gap-6 rounded-2xl border border-white/30 bg-white/80 p-6 shadow-lg backdrop-blur-lg lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/70"
		>
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
					<a href="/">🏆 Root Quest 2.0 🛡️</a>
				</h1>
				<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
					Track every Hack The Box, Proving Grounds, and OSCP lab with a hacker-grade dashboard.
				</p>
			</div>

			<nav class="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
				<div class="flex flex-wrap items-center gap-2">
					{#each navLinks as nav (nav.href)}
						<button
							class={clsx(
								'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
								$page.url.pathname === nav.href
									? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
									: 'border-transparent text-slate-600 hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-300'
							)}
							on:click={() => navigateTo(nav.href)}
							type="button"
						>
							<svelte:component this={nav.icon} size={18} />
							<span>{nav.label}</span>
						</button>
					{/each}
				</div>

				<div class="flex flex-wrap items-center gap-2 md:ml-auto">
					<button
						on:click={toggleExamPrepMode}
						class="rounded-xl bg-slate-200/80 px-3 py-2 text-xs font-semibold tracking-wide text-slate-700 uppercase transition-colors hover:bg-emerald-500/20 hover:text-emerald-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-emerald-300"
						type="button"
					>
						Exam Prep Mode {#if $preferences.examPrepMode}ON ✅{:else}OFF ❌{/if}
					</button>

					<button
						on:click={toggleDarkMode}
						class="rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
						type="button"
						aria-label="Toggle dark mode"
					>
						{#if $preferences.theme === 'dark' || $preferences.darkMode}
							<Sun size={18} />
						{:else}
							<MoonStar size={18} />
						{/if}
					</button>

					<button
						on:click={exportBackup}
						class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:text-emerald-300"
						type="button"
					>
						<Download size={16} /> Backup
					</button>

					<button
						on:click={triggerImport}
						class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:text-emerald-300"
						type="button"
					>
						<Upload size={16} /> Restore
					</button>

					<button
						on:click={resetData}
						title="Reset All Data"
						class="inline-flex items-center gap-2 rounded-xl border border-red-200/60 px-3 py-2 text-red-500 transition-colors hover:bg-red-500/10"
						type="button"
					>
						<RotateCw size={16} /> Reset
					</button>
				</div>
			</nav>
		</header>

		<main class="flex-grow">
			<slot />
		</main>
	</div>

	<footer
		class="mt-8 w-full border-t border-slate-200/70 bg-slate-100 py-4 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
	>
		<p>Powered by Root Quest 2.0</p>
	</footer>

	<input
		bind:this={filePicker}
		type="file"
		accept="application/json"
		class="hidden"
		on:change={importBackup}
	/>
</div>
