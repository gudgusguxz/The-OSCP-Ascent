import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rootquest-preferences';

const THEME_STORAGE_KEY = 'theme';

const defaultPreferences = {
	darkMode: true,
	theme: 'dark',
	examPrepMode: false
};

const VALID_THEMES = new Set(['light', 'dark']);

function applyTheme(theme) {
	if (!browser) return;

	const resolvedTheme = VALID_THEMES.has(theme) ? theme : defaultPreferences.theme;
	const root = document.documentElement;
	root.classList.toggle('dark', resolvedTheme === 'dark');
	root.style.colorScheme = resolvedTheme;
}

function getSystemTheme() {
	if (!browser || typeof window.matchMedia !== 'function') {
		return null;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveStoredTheme(savedPreferences, storedTheme) {
	if (VALID_THEMES.has(storedTheme)) {
		return storedTheme;
	}

	if (savedPreferences && typeof savedPreferences === 'object') {
		if (VALID_THEMES.has(savedPreferences.theme)) {
			return savedPreferences.theme;
		}

		if (savedPreferences.darkMode === true) {
			return 'dark';
		}
	}

	const systemTheme = getSystemTheme();
	if (systemTheme && VALID_THEMES.has(systemTheme)) {
		return systemTheme;
	}

	return defaultPreferences.theme;
}

function loadInitialPreferences() {
	if (!browser) return { ...defaultPreferences };

	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

		const inferredTheme = resolveStoredTheme(saved, storedTheme);
		const initialPreferences = {
			...defaultPreferences,
			...(saved && typeof saved === 'object' ? saved : {}),
			theme: inferredTheme,
			darkMode: inferredTheme === 'dark'
		};

		applyTheme(initialPreferences.theme);
		return initialPreferences;
	} catch (error) {
		console.warn('Failed to parse stored preferences', error);
	}

	applyTheme(defaultPreferences.theme);
	return { ...defaultPreferences };
}

export const preferences = writable(loadInitialPreferences());

preferences.subscribe((value) => {
	if (!browser) {
		return;
	}

	const theme = value?.theme === 'dark' || value?.darkMode ? 'dark' : 'light';
	const nextPreferences = { ...defaultPreferences, ...value, theme, darkMode: theme === 'dark' };

	localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
	localStorage.setItem(THEME_STORAGE_KEY, theme);
	applyTheme(theme);
});

export function toggleTheme() {
	preferences.update((current) => {
		const currentlyDark = current.theme === 'dark' || current.darkMode === true;
		const nextTheme = currentlyDark ? 'light' : 'dark';

		return {
			...current,
			theme: nextTheme,
			darkMode: nextTheme === 'dark'
		};
	});
}
