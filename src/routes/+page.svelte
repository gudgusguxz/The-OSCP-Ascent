<script>
    import { onMount } from 'svelte';
    import { labs as labsStore } from '$lib/stores.js';
    import { ChevronDown, Computer, Bird, Bot, PlusCircle, ExternalLink } from 'lucide-svelte';

    // Import Data
    import htbData from '$lib/data/htb_labs.json';
    import pgPracticeData from '$lib/data/pg_practice_labs.json';

    let activeListKey = 'htb';
    let activeCategoryName = '';
    let newLabName = '', newLabDifficulty = 'Easy', newLabOs = '';
    let showAddForm = false;

    const initialData = { htb: htbData, pg: pgPracticeData };

    onMount(() => {
        if ($labsStore.length === 0 || !$labsStore[0].hasOwnProperty('category') || !$labsStore[0].hasOwnProperty('avatar')) {
            console.log('Data is empty or outdated. Loading initial data...');
            const allInitialLabs = [];
            Object.entries(initialData).forEach(([sourceKey, data]) => {
                data.categories.forEach(category => {
                    category.labs.forEach(lab => {
                        allInitialLabs.push({
                            ...lab,
                            id: `${sourceKey}-${lab.name.toLowerCase().replace(/[\s()]/g, '-')}`,
                            source: sourceKey,
                            category: category.name,
                            completed: false,
                            completedAt: null
                        });
                    });
                });
            });
            $labsStore = allInitialLabs;
        }
        if (initialData[activeListKey].categories.length > 0) {
            activeCategoryName = initialData[activeListKey].categories[0].name;
        }
    });

    $: activeData = initialData[activeListKey];

    $: {
        if (activeData && activeData.categories.length > 0) {
            const categoryExists = activeData.categories.some(c => c.name === activeCategoryName);
            if (!categoryExists) activeCategoryName = activeData.categories[0].name;
        }
    }

    $: labsToShow = $labsStore.filter(lab => 
        lab.source === activeListKey && lab.category === activeCategoryName
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
            id: `${activeListKey}-${newLabName.trim().toLowerCase().replace(/[\s()]/g, '-')}-${Date.now()}`,
            source: activeListKey,
            category: activeCategoryName,
            completed: false,
            completedAt: null
        };
        labsStore.update(currentLabs => [newLab, ...currentLabs]);
        newLabName = ''; newLabDifficulty = 'Easy'; newLabOs = '';
        showAddForm = false;
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

<div class="flex flex-col md:flex-row gap-8">
    <aside class="w-full md:w-80 flex-shrink-0">
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
                <h2 class="text-lg font-bold mb-4 text-slate-800">Scoreboard</h2>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between items-center font-semibold">
                        <span class="text-emerald-600 flex items-center gap-2">Total Owned</span>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{$labsStore.filter(l => l.completed).length}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sky-600 flex items-center gap-2"><Bird size=16/> Linux</span>
                        <span class="font-medium">{osStats['Linux'] || 0}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-blue-600 flex items-center gap-2"><Computer size=16/> Windows</span>
                        <span class="font-medium">{osStats['Windows'] || 0}</span>
                    </div>
                     <div class="flex justify-between items-center">
                        <span class="text-violet-600 flex items-center gap-2"><Bot size=16/> Active Directory</span>
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
                        <div class="bg-white rounded-xl shadow-md border border-slate-100 transition-all hover:shadow-lg overflow-hidden
                                grid grid-cols-3 grid-rows-3 gap-2 p-3" 
                        class:opacity-60={lab.completed}>
                        
                        <div class="row-span-3 bg-slate-100 rounded-lg flex items-center justify-center">
                            {#if lab.avatar}
                                <img src={lab.avatar} alt="{lab.name} icon" class="w-full h-full object-cover rounded-lg">
                            {:else}
                                {#if lab.os?.toLowerCase().includes('linux')} <Bird size={48} class="text-sky-400/70" />
                                {:else if lab.os?.toLowerCase().includes('windows')} <Computer size={48} class="text-blue-400/70" />
                                {:else if lab.os?.toLowerCase().includes('ad')} <Bot size={48} class="text-violet-400/70" />
                                {/if}
                            {/if}
                        </div>

                        <div class="col-span-2 flex justify-between items-start">
                            <p class="font-bold text-lg text-slate-800 pr-2">{lab.name}</p>
                            <span class="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                                    class:bg-emerald-100={lab.difficulty?.toLowerCase().includes('easy')}
                                    class:text-emerald-800={lab.difficulty?.toLowerCase().includes('easy')}
                                    class:bg-amber-100={lab.difficulty?.toLowerCase().includes('medium') || lab.difficulty?.toLowerCase().includes('intermediate')}
                                    class:text-amber-800={lab.difficulty?.toLowerCase().includes('medium') || lab.difficulty?.toLowerCase().includes('intermediate')}
                                    class:bg-red-100={lab.difficulty?.toLowerCase().includes('hard')}
                                    class:text-red-800={lab.difficulty?.toLowerCase().includes('hard')}
                            >{lab.difficulty || 'N/A'}</span>
                        </div>

                        <div class="col-span-2 row-span-2 flex flex-col justify-between">
                            <p class="text-sm text-slate-500">{lab.os || 'N/A'}</p>
                            
                            <div class="flex justify-between items-center mt-2">
                                <div>
                                    {#if activeListKey === 'htb'}
                                    <a href={`https://www.hackthebox.com/machines/${lab.name}`} target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-emerald-600 transition-colors" title="View on Hack The Box">
                                        <ExternalLink size={18} />
                                    </a>
                                    {/if}
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