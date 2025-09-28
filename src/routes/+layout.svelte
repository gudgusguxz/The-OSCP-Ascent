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
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import clsx from 'clsx';

	import { preferences, toggleTheme } from '$lib/preferencesStore.js';
	import { labs, normalizeLabsCollection } from '$lib/stores.js';

	let filePicker;

	const navLinks = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/stats', label: 'Timeline & Graphs', icon: LineChart },
		{ href: '/writeups', label: 'Blog Mode', icon: NotebookPen }
	];

	onMount(() => {
		if (browser) {
			const storedTheme = localStorage.getItem('theme');
			const currentPreferences = get(preferences);
			const isDark = storedTheme
				? storedTheme === 'dark'
				: Boolean(currentPreferences.theme === 'dark' || currentPreferences.darkMode);

			document.documentElement.classList.toggle('dark', isDark);

			if (Boolean(currentPreferences.theme === 'dark') !== isDark) {
				preferences.set({
					...currentPreferences,
					theme: isDark ? 'dark' : 'light',
					darkMode: isDark
				});
			}
		}
	});

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

<div class="flex min-h-screen flex-col text-slate-200 transition-colors">
	<div class="container mx-auto flex w-full flex-grow flex-col gap-8 p-4 md:p-8 lg:max-w-7xl">
		<header
			class="glass-panel relative flex flex-col gap-6 overflow-hidden p-6 lg:flex-row lg:items-center lg:justify-between"
		>
			<div>
				<div class="pointer-events-none absolute inset-0 -z-10 opacity-70">
					<div
						class="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl"
					></div>
					<div
						class="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
					></div>
				</div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-100">
					<a href="/">🏆 Root Quest 2.0 🛡️</a>
				</h1>
				<p class="mt-2 text-sm text-slate-300">
					Track every Hack The Box, Proving Grounds, and OSCP lab with a hacker-grade dashboard.
				</p>
			</div>

			<nav class="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
				<div class="flex flex-wrap items-center gap-2">
					{#each navLinks as nav (nav.href)}
						<button
							class={clsx(
								'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold backdrop-blur-sm transition-colors',
								$page.url.pathname === nav.href
									? 'border-cyan-400/70 bg-[rgba(12,78,125,0.35)] text-cyan-100 shadow-[0_20px_55px_rgba(8,145,178,0.45)]'
									: 'border-transparent text-slate-300 hover:border-cyan-400/35 hover:bg-[rgba(8,19,38,0.65)] hover:text-cyan-100'
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
						class="rounded-xl border border-emerald-400/20 bg-[rgba(9,19,35,0.75)] px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 uppercase transition-colors hover:border-emerald-400/45 hover:bg-[rgba(16,185,129,0.16)] hover:text-emerald-200"
						type="button"
					>
						Exam Prep Mode {#if $preferences.examPrepMode}ON ✅{:else}OFF ❌{/if}
					</button>

					<button
						on:click={toggleDarkMode}
						class="rounded-xl border border-cyan-400/20 bg-[rgba(9,19,35,0.75)] p-2 text-slate-200 transition-colors hover:border-cyan-400/50 hover:bg-[rgba(8,145,178,0.16)] hover:text-cyan-100"
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
						class="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-[rgba(9,19,35,0.75)] px-3 py-2 text-slate-200 transition-colors hover:border-emerald-400/45 hover:bg-[rgba(16,185,129,0.14)] hover:text-emerald-200"
						type="button"
					>
						<Download size={16} /> Backup
					</button>

					<button
						on:click={triggerImport}
						class="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-[rgba(9,19,35,0.75)] px-3 py-2 text-slate-200 transition-colors hover:border-sky-400/45 hover:bg-[rgba(56,189,248,0.14)] hover:text-sky-200"
						type="button"
					>
						<Upload size={16} /> Restore
					</button>

					<button
						on:click={resetData}
						title="Reset All Data"
						class="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-[rgba(63,12,24,0.42)] px-3 py-2 text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-[rgba(244,63,94,0.16)] hover:text-rose-200"
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
		class="mt-8 w-full border-t border-white/5 bg-[rgba(7,15,32,0.85)] py-4 text-center text-sm text-slate-400 backdrop-blur-xl"
	>
		<p>Powered by gudgusguz </p>
	</footer>

	<input
		bind:this={filePicker}
		type="file"
		accept="application/json"
		class="hidden"
		on:change={importBackup}
	/>
</div>
