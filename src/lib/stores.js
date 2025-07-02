import { writable } from 'svelte/store';

function createPersistentStore(key, startValue) {
    const isBrowser = typeof window !== 'undefined';
    const storedValue = isBrowser ? localStorage.getItem(key) : null;
    const initialValue = storedValue ? JSON.parse(storedValue) : startValue;

    const store = writable(initialValue);

    if (isBrowser) {
        store.subscribe(value => {
            localStorage.setItem(key, JSON.stringify(value));
        });
    }
    return store;
}

export const labs = createPersistentStore('my-advanced-labs', []);