<script>
  import "../app.css";
  import { RotateCw, Github } from 'lucide-svelte';

  function resetData() {
    if (confirm('Are you sure you want to reset all data?')) {
        localStorage.removeItem('my-advanced-labs');
        window.location.reload();
    }
  }
</script>

<div class="flex flex-col min-h-screen bg-slate-50 text-slate-800">
  <div class="container mx-auto p-4 md:p-8 flex flex-col flex-grow w-full">
    <header class="flex flex-col sm:flex-row justify-between items-center p-6 rounded-xl bg-white/70 backdrop-blur-lg border border-white/30 shadow-md mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-4 sm:mb-0">
        <a href="/">🏆 Root Quest V0.9 🛡️</a>
      </h1>
      <nav>
        <button on:click={resetData} title="Reset All Data" class="text-slate-500 font-semibold hover:text-red-500 transition-colors flex items-center gap-2 p-2 rounded-md hover:bg-red-50">
            <RotateCw size={18} />
            <span>Reset Data</span>
        </button>
      </nav>
    </header>

    <main class="flex-grow">
      <slot />
    </main>
  </div>

  <footer class="text-center py-4 text-slate-500 text-sm w-full bg-slate-100 border-t border-slate-200 mt-8 flex justify-center items-center gap-4">
    <span>Powered by gudgusguz</span>
    <span class="text-slate-300">|</span>
    
    <a href="https://github.com/gudgusguxz/The-OSCP-Ascent" 
       target="_blank" 
       rel="noopener noreferrer" 
       class="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
       aria-label="View source on GitHub">
        <Github size={16} />
        <span>View Source</span>
    </a>
  </footer>
</div>
