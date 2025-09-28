import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rootquest-preferences';

const THEME_STORAGE_KEY = 'theme';

const defaultPreferences = {
	darkMode: false,
	theme: 'light',
	examPrepMode: false
};

function loadInitialPreferences() {
	if (!browser) return defaultPreferences;
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

		if (saved && typeof saved === 'object') {
			const inferredTheme =
				storedTheme === 'dark' ? 'dark' : saved.theme || defaultPreferences.theme;
			return {
				...defaultPreferences,
				...saved,
				theme: inferredTheme,
				darkMode: inferredTheme === 'dark'
			};
		}

		if (storedTheme === 'dark') {
			return { ...defaultPreferences, darkMode: true, theme: 'dark' };
		}
	} catch (error) {
		console.warn('Failed to parse stored preferences', error);
	}
	return defaultPreferences;
}

export const preferences = writable(loadInitialPreferences());

preferences.subscribe((value) => {
	if (browser) {
		const theme = value?.theme === 'dark' || value?.darkMode ? 'dark' : 'light';
		const nextPreferences = { ...value, theme, darkMode: theme === 'dark' };

		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
		localStorage.setItem(THEME_STORAGE_KEY, theme);
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}
});
