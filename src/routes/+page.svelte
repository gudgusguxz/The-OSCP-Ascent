<script>
    import { onMount } from 'svelte';
    import { labs as labsStore } from '$lib/stores.js';
    import { ChevronDown, Computer, Bird, Bot, PlusCircle, ExternalLink, NotepadText, Save, X, Trash2, Edit2, Plus, GripVertical } from 'lucide-svelte';
    import clsx from 'clsx'; // Import clsx

    // Import Data
    import htbData from '$lib/data/htb_labs.json';
    import pgPracticeData from '$lib/data/pg_practice_labs.json';

    let activeListKey = 'htb';
    let activeCategoryName = '';
    let newLabName = '', newLabDifficulty = 'Easy', newLabOs = '';
    let showAddForm = false;

    // State สำหรับ Note Modal
    let showNoteModal = false;
    let activeNoteLab = null; // Lab object ที่กำลังเปิด Note Modal
    
    // State สำหรับการจัดการ Note รายรายการภายใน Modal
    let newIndividualNoteContent = ''; // เนื้อหาสำหรับ Note ใหม่ที่กำลังจะเพิ่ม
    let editingIndividualNoteId = null; // ID ของ Note รายการที่กำลังแก้ไข
    let editingIndividualNoteContent = ''; // เนื้อหาของ Note รายการที่กำลังแก้ไข

    const MAX_NOTE_LINES = 15;
    const MAX_NOTE_CHARS = 1000;

    const initialData = { htb: htbData, pg: pgPracticeData };

    onMount(() => {
        let needsInitialization = false;
        if ($labsStore.length === 0) {
            needsInitialization = true;
        } else {
            // Check if existing data is "outdated" or malformed based on new schema
            // For example, if the first lab doesn't have 'category' or 'notes' is not an array
            const firstLab = $labsStore[0];
            if (!firstLab || !firstLab.hasOwnProperty('category') || !Array.isArray(firstLab.notes)) {
                needsInitialization = true; // Re-initialize if schema is old/malformed
                console.log('Existing data schema outdated or malformed. Re-initializing...');
            }
        }

        if (needsInitialization) {
            console.log('Loading initial data...');
            const allInitialLabs = [];
            Object.entries(initialData).forEach(([sourceKey, data]) => {
                data.categories.forEach(category => {
                    category.labs.forEach(lab => {
                        allInitialLabs.push({
                            ...lab,
                            id: `${sourceKey}-${lab.name.toLowerCase().replace(/[\s()]/g, '-')}-${crypto.randomUUID()}`, // Ensure unique ID
                            source: sourceKey,
                            category: category.name,
                            completed: false,
                            completedAt: null,
                            notes: [] // Always initialize notes as an empty array
                        });
                    });
                });
            });
            $labsStore = allInitialLabs;
        } else {
            // Ensure any existing labs have the 'notes' array property, just in case,
            // and ensure old labs get proper IDs if they don't have one (though store.js already handles this).
            $labsStore = $labsStore.map(lab => {
                let currentNotes = Array.isArray(lab.notes) ? lab.notes : [];
                if (typeof lab.notes === 'string' && lab.notes !== '') {
                    currentNotes = [{ id: crypto.randomUUID(), content: lab.notes, timestamp: new Date().toISOString() }];
                }
                return {
                    ...lab,
                    notes: currentNotes,
                    id: lab.id || `${lab.source || 'unknown'}-${lab.name?.toLowerCase().replace(/[\s()]/g, '-') || 'unknown'}-${crypto.randomUUID()}` // Ensure ID for old labs too
                };
            });
        }

        if (initialData?.[activeListKey]?.categories?.length > 0) {
            activeCategoryName = initialData?.[activeListKey]?.categories?.[0]?.name;
        }
    });

    $: activeData = initialData?.[activeListKey];

    $: {
        // Ensure activeData.categories exists before accessing its properties
        if (activeData?.categories && activeData.categories.length > 0) {
            const categoryExists = activeData.categories.some(c => c.name === activeCategoryName);
            if (!categoryExists) activeCategoryName = activeData.categories?.[0]?.name;
        }
    }

    $: labsToShow = $labsStore.filter(lab =>
        // Add robust check here as well to ensure 'lab' is a valid object
        lab && lab.source === activeListKey && lab.category === activeCategoryName
    ).sort((a,b) => (b.completed - a.completed) || a.name.localeCompare(b.name));

    $: osStats = $labsStore.filter(lab => lab.completed).reduce((acc, lab) => {
        let osKey = 'Other';
        const osLower = lab.os?.toLowerCase() || '';
        if (osLower.includes('ad') || lab.category?.toLowerCase().includes('directory')) osKey = 'Active Directory';
        else if (osLower.includes('linux')) osKey = 'Linux';
        else if (osLower.includes('windows')) osKey = 'Windows';
        if (!acc[osKey]) acc[osKey] = 0;
        acc[osKey]++;
        return acc;
    }, { Linux: 0, Windows: 0, AD: 0 });

    function toggleLabStatus(id) {
        labsStore.update(currentLabs => currentLabs.map(lab => {
            if (lab.id === id) {
                const isCompleted = !lab.completed;
                return { ...lab, completed: isCompleted, completedAt: isCompleted ? new Date().toISOString() : null };
            }
            return lab;
        }));
    }

    function handleAddLab() {
        if (!newLabName.trim()) return alert('Lab Name is required.');
        const newLab = {
            name: newLabName.trim(),
            difficulty: newLabDifficulty,
            os: newLabOs.trim(),
            avatar: '',
            id: `${activeListKey}-${newLabName.trim().toLowerCase().replace(/[\s()]/g, '-')}-${crypto.randomUUID()}`,
            source: activeListKey,
            category: activeCategoryName,
            completed: false,
            completedAt: null,
            notes: [] // Initial notes as an empty array
        };
        labsStore.update(currentLabs => [newLab, ...currentLabs]);
        newLabName = ''; newLabDifficulty = 'Easy'; newLabOs = '';
        showAddForm = false;
    }

    function openNoteModal(lab) {
        activeNoteLab = lab;
        newIndividualNoteContent = '';
        editingIndividualNoteId = null;
        editingIndividualNoteContent = '';
        showNoteModal = true;
    }

    function closeNoteModal() {
        showNoteModal = false;
        activeNoteLab = null;
        newIndividualNoteContent = '';
        editingIndividualNoteId = null;
        editingIndividualNoteContent = '';
    }

    // --- Individual Note Management Functions ---

    function addIndividualNote() {
        if (!newIndividualNoteContent.trim()) return;

        const newNote = {
            id: crypto.randomUUID(), // Generate a unique ID for the new note
            content: newIndividualNoteContent.trim(),
            timestamp: new Date().toISOString()
        };

        labsStore.update(currentLabs => currentLabs.map(lab => {
            if (lab.id === activeNoteLab.id) {
                // Ensure lab.notes is an array before spreading
                return { ...lab, notes: [...(lab.notes || []), newNote] };
            }
            return lab;
        }));
        newIndividualNoteContent = ''; // Clear input after adding
        // Update activeNoteLab to reflect changes immediately in modal
        activeNoteLab.notes = [...(activeNoteLab.notes || []), newNote];
    }

    function startEditIndividualNote(note) {
        editingIndividualNoteId = note.id;
        editingIndividualNoteContent = note.content;
    }

    function saveIndividualNote() {
        if (!editingIndividualNoteId || !editingIndividualNoteContent.trim()) return;

        labsStore.update(currentLabs => currentLabs.map(lab => {
            if (lab.id === activeNoteLab.id) {
                return {
                    ...lab,
                    notes: (lab.notes || []).map(note => // Ensure lab.notes is an array before map
                        note.id === editingIndividualNoteId
                            ? { ...note, content: editingIndividualNoteContent.trim(), timestamp: new Date().toISOString() }
                            : note
                    )
                };
            }
            return lab;
        }));
        // Update activeNoteLab to reflect changes immediately in modal
        activeNoteLab.notes = (activeNoteLab.notes || []).map(note => // Ensure activeNoteLab.notes is an array before map
            note.id === editingIndividualNoteId
                ? { ...note, content: editingIndividualNoteContent.trim(), timestamp: new Date().toISOString() }
                : note
        );

        cancelEditIndividualNote();
    }

    function cancelEditIndividualNote() {
        editingIndividualNoteId = null;
        editingIndividualNoteContent = '';
    }

    function deleteIndividualNote(noteId) {
        if (confirm('Are you sure you want to delete this note entry?')) {
            labsStore.update(currentLabs => currentLabs.map(lab => {
                if (lab.id === activeNoteLab.id) {
                    return { ...lab, notes: (lab.notes || []).filter(note => note.id !== noteId) }; // Ensure lab.notes is an array before filter
                }
                return lab;
            }));
            // Update activeNoteLab to reflect changes immediately in modal
            activeNoteLab.notes = (activeNoteLab.notes || []).filter(note => note.id !== noteId); // Ensure activeNoteLab.notes is an array before filter
        }
    }

    // --- Validation for new/edited individual notes ---
    function checkNewNoteContent() {
        const lines = newIndividualNoteContent.split('\n').length;
        if (lines > MAX_NOTE_LINES) {
            newIndividualNoteContent = newIndividualNoteContent.split('\n').slice(0, MAX_NOTE_LINES).join('\n');
        }
        if (newIndividualNoteContent.length > MAX_NOTE_CHARS) {
            newIndividualNoteContent = newIndividualNoteContent.substring(0, MAX_NOTE_CHARS);
        }
    }

    function checkEditingNoteContent() {
        const lines = editingIndividualNoteContent.split('\n').length;
        if (lines > MAX_NOTE_LINES) {
            editingIndividualNoteContent = editingIndividualNoteContent.split('\n').slice(0, MAX_NOTE_LINES).join('\n');
        }
        if (editingIndividualNoteContent.length > MAX_NOTE_CHARS) {
            editingIndividualNoteContent = editingIndividualNoteContent.substring(0, MAX_NOTE_CHARS);
        }
    }
</script>

<svelte:head>
    <title>The OSCP Ascent</title>
</svelte:head>

<div class="mb-8">
    <label for="list-select" class="block text-sm font-medium text-slate-600 mb-2">Select Target List:</label>
    <div class="relative">
        <select id="list-select" bind:value={activeListKey} class="w-full md:w-auto appearance-none bg-white border border-slate-300 text-slate-800 font-semibold py-2 px-4 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            {#each Object.entries(initialData) as [key, data]}
                <option value={key}>{data.listName}</option>
            {/each}
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 md:w-auto w-full">
            <ChevronDown size={20} />
        </div>
    </div>
</div>

<div class="flex flex-col md:flex-row gap-5">
    <aside class="w-full md:w-60 flex-shrink-0">
        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-8">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-slate-800">Categories</h2>
                <button on:click={() => showAddForm = !showAddForm} class="text-emerald-500 hover:text-emerald-600 transition-colors p-1 rounded-full hover:bg-emerald-100">
                    <PlusCircle size={24} />
                </button>
            </div>

            {#if showAddForm}
            <div class="mb-4 pt-4 border-t border-slate-200">
                <form on:submit|preventDefault={handleAddLab} class="space-y-4">
                    <div>
                        <label for="new-lab-name" class="block text-sm font-medium text-slate-600 mb-1">Lab Name</label>
                        <input id="new-lab-name" type="text" placeholder="Add to '{activeCategoryName}'..." required bind:value={newLabName} class="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="new-lab-difficulty" class="block text-sm font-medium text-slate-600 mb-1">Difficulty</label>
                            <select id="new-lab-difficulty" bind:value={newLabDifficulty} class="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                        <div>
                            <label for="new-lab-os" class="block text-sm font-medium text-slate-600 mb-1">OS</label>
                            <input id="new-lab-os" type="text" placeholder="e.g., Linux" bind:value={newLabOs} class="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-emerald-500 text-white font-bold p-2 rounded-md hover:bg-emerald-600 transition-colors">Add Lab</button>
                </form>
            </div>
            {/if}

            <nav class="flex flex-col gap-1">
                {#if activeData}
                    {#each activeData.categories as category}
                        <button on:click={() => activeCategoryName = category.name} class="w-full text-left px-3 py-2 text-sm font-semibold rounded-md transition-colors flex justify-between items-center" class:bg-emerald-100={activeCategoryName === category.name} class:text-emerald-700={activeCategoryName === category.name} class:text-slate-600={activeCategoryName !== category.name} class:hover:bg-slate-100={activeCategoryName !== category.name}>
                            <span>{category.name}</span>
                            <span class="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{category.labs.length}</span>
                        </button>
                    {/each}
                {/if}
            </nav>

            <div class="mt-6 pt-4 border-t border-slate-200">
                <h2 class="text-xl font-bold mb-4 text-slate-800">Scoreboard</h2>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between items-center font-semibold">
                        <span class="text-base text-emerald-600 flex items-center gap-2">Total Owned</span>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{$labsStore.filter(l => l.completed).length}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="flex items-center gap-2">
                        <img src="https://img.icons8.com/?size=100&id=HF4xGsjDERHf&format=png&color=000000" alt="Linux Icon" width="25" height="50" /> Linux</span>
                        <span class="font-medium">{osStats['Linux'] || 0}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="flex items-center gap-2">
                        <img src="https://img.icons8.com/?size=100&id=9Upks1A4mqpl&format=png&color=000000" alt="Windows Icon" width="25" height="50" /> Windows</span>
                        <span class="font-medium">{osStats['Windows'] || 0}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="flex items-center gap-2">
                        <img src="https://img.icons8.com/?size=100&id=XNsUnRhsQAzH&format=png&color=000000" alt="AD Icon" width="25" height="50" /> Active Directory
                        </span>
                        <span class="font-medium">{osStats['Active Directory'] || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    </aside>

    <div class="flex-grow">
        {#if activeCategoryName}
        <section>
            <h2 class="text-2xl font-bold mb-4">{activeCategoryName} <span class="text-base font-normal text-slate-500">({labsToShow.length} items)</span></h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each labsToShow as lab (lab.id)}
                        <div class={clsx(
                                "bg-white rounded-xl shadow-md border border-slate-100 transition-all hover:shadow-lg overflow-hidden",
                                "grid grid-cols-3 grid-rows-3 gap-2 p-3",
                                { "opacity-60": lab.completed }
                            )}>

                        <div class="row-span-3 bg-slate-100 rounded-lg flex items-center justify-center">
                            {#if lab.avatar}
                                <img src={lab.avatar} alt="{lab.name} icon" class="w-full h-full object-cover rounded-lg">
                            {:else}
                                {#if lab.os?.toLowerCase().includes('linux')} <Bird size={64} class="text-sky-400/70" />
                                {:else if lab.os?.toLowerCase().includes('windows')} <Computer size={64} class="text-blue-400/70" />
                                {:else if lab.os?.toLowerCase().includes('ad')} <Bot size={64} class="text-violet-400/70" />
                                {/if}
                            {/if}
                        </div>

                        <div class="col-span-2 flex justify-between items-start">
                            <p class="font-bold text-lg text-slate-800 pr-2">{lab.name}</p>
                            <span class={clsx(
                                "text-xs font-bold px-2 py-1 rounded-full flex-shrink-0",
                                { "bg-emerald-100 text-emerald-800": lab.difficulty?.toLowerCase().includes('easy') },
                                { "bg-amber-100 text-amber-800": lab.difficulty?.toLowerCase().includes('medium') || lab.difficulty?.toLowerCase().includes('intermediate') },
                                { "bg-red-100 text-red-800": lab.difficulty?.toLowerCase().includes('hard') }
                            )}
                            >{lab.difficulty || 'N/A'}</span>
                        </div>

                        <div class="col-span-2 row-span-2 flex flex-col justify-between">
                            <p class="text-sm text-slate-500">{lab.os || 'N/A'}</p>

                            <div class="flex justify-between items-center mt-2">
                                <div class="flex items-center gap-2"> {#if activeListKey === 'htb'}
                                    <a href={`https://www.hackthebox.com/machines/${lab.name}`} target="_blank" rel="noopener noreferrer" class="p-1 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 transition-colors" title="View on Hack The Box">
                                        <ExternalLink size={20} />
                                    </a>
                                    {/if}
                                    <button on:click={() => openNoteModal(lab)}
                                        class={clsx(
                                            "p-1 rounded-full transition-colors",
                                            lab.notes.length > 0 ? "text-emerald-600 hover:bg-emerald-100" : "text-slate-400 hover:bg-slate-100"
                                        )}
                                        title="{lab.notes.length > 0 ? 'Edit Notes' : 'Add Notes'}"
                                    >
                                        <NotepadText size={20} />
                                    </button>
                                </div>
                                <div class="flex items-center gap-2">
                                    <label for="cb-{lab.id}" class="text-sm font-medium text-slate-600 cursor-pointer">Owned</label>
                                    <input id="cb-{lab.id}" type="checkbox" checked={lab.completed} on:change={() => toggleLabStatus(lab.id)} class="h-5 w-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer">
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </section>
        {/if}
    </div>
</div>

{#if showNoteModal && activeNoteLab}
<div class="fixed top-0 left-0 w-full h-full bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-lg border border-slate-100 p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <h3 class="text-xl font-bold text-slate-800 mb-4 border-b pb-2">{activeNoteLab.name} - Manage Notes</h3>

        {#if activeNoteLab.notes && activeNoteLab.notes.length > 0}
        <div class="flex-grow overflow-y-auto mb-4 p-2 bg-slate-50 border border-slate-200 rounded-md space-y-3">
            {#each activeNoteLab.notes as note (note.id)}
            <div class="flex items-start gap-3 p-2 rounded-md hover:bg-slate-100 transition-colors">
                <div class="flex-shrink-0 text-slate-400 mt-1">
                    <GripVertical size={16} />
                </div>
                <div class="flex-grow">
                    {#if editingIndividualNoteId === note.id}
                        <textarea
                            bind:value={editingIndividualNoteContent}
                            on:input={checkEditingNoteContent}
                            class="w-full p-2 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                            rows="3"
                            maxlength={MAX_NOTE_CHARS}
                        ></textarea>
                        <div class="flex justify-end gap-2 mt-2">
                            <button on:click={saveIndividualNote} class="bg-emerald-500 text-white font-bold px-3 py-1 rounded-md hover:bg-emerald-600 transition-colors text-sm">
                                <Save size={16} class="inline-block mr-1" /> Save
                            </button>
                            <button on:click={cancelEditIndividualNote} class="bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-md hover:bg-slate-300 transition-colors text-sm">
                                <X size={16} class="inline-block mr-1" /> Cancel
                            </button>
                        </div>
                    {:else}
                        <p class="whitespace-pre-wrap font-mono text-slate-800 text-sm">{note.content}</p>
                        <div class="flex justify-end gap-2 text-slate-500 text-xs mt-1">
                            <span class="mr-auto text-slate-400">{new Date(note.timestamp).toLocaleString()}</span>
                            <button on:click={() => startEditIndividualNote(note)} class="hover:text-blue-500 p-1 rounded-md hover:bg-blue-50" title="Edit Note">
                                <Edit2 size={16} />
                            </button>
                            <button on:click={() => deleteIndividualNote(note.id)} class="hover:text-red-500 p-1 rounded-md hover:bg-red-50" title="Delete Note">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
            {/each}
        </div>
        {:else}
        <div class="flex-grow flex items-center justify-center bg-slate-50 border border-slate-200 rounded-md p-3 mb-4">
            <p class="text-slate-500 italic">No notes added for this lab yet.</p>
        </div>
        {/if}

        <div class="mt-auto pt-4 border-t border-slate-200">
            <h4 class="font-semibold text-slate-700 mb-2">Add New Note Entry:</h4>
            <textarea
                bind:value={newIndividualNoteContent}
                on:input={checkNewNoteContent}
                placeholder="Type your new note here (Max {MAX_NOTE_LINES} lines, {MAX_NOTE_CHARS} chars)..."
                class="w-full p-2 border border-slate-300 rounded-md text-sm mb-2 font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                rows="3"
                maxlength={MAX_NOTE_CHARS}
            ></textarea>
            <div class="flex justify-end">
                <button on:click={addIndividualNote} class="bg-emerald-500 text-white font-bold p-2 rounded-md hover:bg-emerald-600 transition-colors flex items-center gap-1">
                    <Plus size={18} /> Add Note
                </button>
            </div>
        </div>

        <div class="flex justify-end gap-2 mt-4">
            <button on:click={closeNoteModal} class="bg-slate-200 text-slate-700 font-bold p-2 rounded-md hover:bg-slate-300 transition-colors">
                <X size={18} class="inline-block mr-2" /> Close
            </button>
        </div>
    </div>
</div>
{/if}
