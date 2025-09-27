import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'my-advanced-labs';

const initialLabs = browser ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') : [];

const ensureHistoryEvent = (event) => ({
	id: event?.id || crypto.randomUUID(),
	type: event?.type || 'status',
	status: event?.status ?? null,
	noteId: event?.noteId ?? null,
	timestamp: event?.timestamp || new Date().toISOString(),
	summary: event?.summary || ''
});

export function normalizeLab(lab) {
	if (!lab || typeof lab !== 'object') {
		console.warn('Malformed lab entry found in localStorage:', lab);
		return {
			id: crypto.randomUUID(),
			name: 'Unknown Lab',
			os: 'Unknown',
			difficulty: 'Unknown',
			avatar: '',
			source: 'Unknown',
			category: 'Unknown',
			status: 'not_started',
			completed: false,
			completedAt: null,
			startedAt: null,
			notes: [],
			services: [],
			cves: [],
			tags: [],
			history: []
		};
	}

	let newNotes;
	if (Array.isArray(lab.notes)) {
		newNotes = lab.notes.map((note) => ({
			id: note.id || crypto.randomUUID(),
			content: note.content || '',
			timestamp: note.timestamp || new Date().toISOString()
		}));
	} else if (typeof lab.notes === 'string' && lab.notes !== '') {
		newNotes = [
			{ id: crypto.randomUUID(), content: lab.notes, timestamp: new Date().toISOString() }
		];
	} else {
		newNotes = [];
	}

	const statusFromLegacy = lab.status || (lab.completed ? 'owned' : 'not_started');
	const completedAt =
		lab.completedAt || (statusFromLegacy === 'owned' ? new Date().toISOString() : null);

	return {
		...lab,
		id:
			lab.id ||
			`${lab.source || 'unknown'}-${
				lab.name?.toLowerCase().replace(/[\s()]/g, '-') || 'unknown'
			}-${crypto.randomUUID()}`,
		name: lab.name || 'Unknown Lab',
		os: lab.os || 'Unknown',
		difficulty: lab.difficulty || 'Unknown',
		source: lab.source || 'Unknown',
		category: lab.category || 'Unknown',
		status: statusFromLegacy,
		completed: statusFromLegacy === 'owned',
		startedAt: lab.startedAt || null,
		completedAt,
		services: Array.isArray(lab.services) ? lab.services : [],
		cves: Array.isArray(lab.cves) ? lab.cves : [],
		tags: Array.isArray(lab.tags) ? lab.tags : [],
		notes: newNotes,
		history: Array.isArray(lab.history) ? lab.history.map(ensureHistoryEvent) : []
	};
}

export function normalizeLabsCollection(collection) {
	return Array.isArray(collection) ? collection.map((item) => normalizeLab(item)) : [];
}

// Ensure all labs have required properties and a consistent schema
const labsWithNotes = normalizeLabsCollection(initialLabs);

export const labs = writable(labsWithNotes);

labs.subscribe((value) => {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	}
});

export function recordLabEvent(lab, event) {
	return {
		...lab,
		history: [...(lab.history || []), ensureHistoryEvent(event)]
	};
}
