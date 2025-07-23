import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const initialLabs = browser ? JSON.parse(localStorage.getItem('my-advanced-labs') || '[]') : [];

// Ensure all labs have required properties and 'notes' as an array of note objects
const labsWithNotes = initialLabs.map(lab => {
    // Defensive check for lab existence and basic properties
    if (!lab || typeof lab !== 'object') {
        console.warn('Malformed lab entry found in localStorage:', lab);
        // Return a default valid lab structure or skip it if it's completely malformed
        return {
            id: crypto.randomUUID(), // Ensure a unique ID
            name: 'Unknown Lab', // Default name
            os: 'Unknown',
            difficulty: 'Unknown',
            avatar: '',
            source: 'Unknown',
            category: 'Unknown',
            completed: false,
            completedAt: null,
            notes: []
        };
    }

    let newNotes;
    if (Array.isArray(lab.notes)) {
        newNotes = lab.notes.map(note => ({
            id: note.id || crypto.randomUUID(), // Add ID if missing
            content: note.content || '',
            timestamp: note.timestamp || new Date().toISOString()
        }));
    } else if (typeof lab.notes === 'string' && lab.notes !== '') {
        newNotes = [{ id: crypto.randomUUID(), content: lab.notes, timestamp: new Date().toISOString() }];
    } else {
        newNotes = [];
    }

    return {
        ...lab,
        // Ensure core properties exist, defaulting if missing
        id: lab.id || `${lab.source || 'unknown'}-${lab.name?.toLowerCase().replace(/[\s()]/g, '-') || 'unknown'}-${crypto.randomUUID()}`,
        name: lab.name || 'Unknown Lab',
        os: lab.os || 'Unknown',
        difficulty: lab.difficulty || 'Unknown',
        source: lab.source || 'Unknown',
        category: lab.category || 'Unknown',
        completed: !!lab.completed, // Ensure boolean value
        notes: newNotes
    };
});

export const labs = writable(labsWithNotes);

labs.subscribe((value) => {
    if (browser) {
        localStorage.setItem('my-advanced-labs', JSON.stringify(value));
    }
});
