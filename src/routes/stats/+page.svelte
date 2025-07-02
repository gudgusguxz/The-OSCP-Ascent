<script>
    import { labs } from '$lib/stores.js';

    $: completedLabs = $labs.filter(lab => lab.completed && lab.completedAt);

    $: monthlyStats = completedLabs.reduce((acc, lab) => {
        const date = new Date(lab.completedAt);
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!acc[monthYear]) {
            acc[monthYear] = 0;
        }
        acc[monthYear]++;
        return acc;
    }, {});
</script>

<svelte:head>
    <title>Stats - Lab Tracker</title>
</svelte:head>

<section class="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
    <h2 class="text-xl font-bold mb-4">Monthly Completion Stats</h2>
    <p class="text-slate-600 mb-6">Total Labs Completed: <span class="font-bold text-emerald-500">{completedLabs.length}</span></p>

    {#if Object.keys(monthlyStats).length === 0}
        <p class="text-center text-slate-500 py-8">No completed labs yet. Go pwn some boxes!</p>
    {:else}
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each Object.entries(monthlyStats) as [month, count]}
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                    <h3 class="font-semibold text-slate-700">{month}</h3>
                    <p class="text-4xl font-bold text-emerald-500 my-2">{count}</p>
                    <span class="text-sm text-slate-500">Lab{count > 1 ? 's' : ''} Completed</span>
                </div>
            {/each}
        </div>
    {/if}
</section>