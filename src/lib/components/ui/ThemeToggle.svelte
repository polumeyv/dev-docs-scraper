<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { theme, resolvedTheme } from '$lib/stores/theme';
	
	function toggleTheme() {
		theme.set($resolvedTheme === 'dark' ? 'light' : 'dark');
	}
</script>

<button
	onclick={toggleTheme}
	class="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
	aria-label="Toggle theme"
>
	{#if $resolvedTheme === 'dark'}
		<Moon size={20} />
	{:else}
		<Sun size={20} />
	{/if}
</button>