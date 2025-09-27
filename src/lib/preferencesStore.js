import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rootquest-preferences';

const defaultPreferences = {
	darkMode: false,
	examPrepMode: false
};

function loadInitialPreferences() {
	if (!browser) return defaultPreferences;
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		if (saved && typeof saved === 'object') {
			return { ...defaultPreferences, ...saved };
		}
	} catch (error) {
		console.warn('Failed to parse stored preferences', error);
	}
	return defaultPreferences;
}

export const preferences = writable(loadInitialPreferences());

preferences.subscribe((value) => {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		document.documentElement.classList.toggle('dark', Boolean(value?.darkMode));
	}
});
