<script lang="ts">
	import { Search, X, Loader2 } from 'lucide-svelte';
	
	interface Props {
		value?: string;
		placeholder?: string;
		loading?: boolean;
		suggestions?: string[];
		showSuggestions?: boolean;
		onsearch?: (value: string) => void;
		oninput?: (value: string) => void;
	}
	
	let {
		value = $bindable(''),
		placeholder = 'Search...',
		loading = false,
		suggestions = [],
		showSuggestions = false,
		onsearch,
		oninput
	}: Props = $props();
	
	let inputEl: HTMLInputElement;
	let focused = $state(false);
	
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			onsearch?.(value);
		} else if (e.key === 'Escape') {
			value = '';
			inputEl?.blur();
		}
	}
	
	function selectSuggestion(suggestion: string) {
		value = suggestion;
		onsearch?.(suggestion);
		focused = false;
	}
	
	// Keyboard shortcut (Cmd/Ctrl + K)
	$effect(() => {
		function handleGlobalKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				inputEl?.focus();
			}
		}
		
		document.addEventListener('keydown', handleGlobalKeyDown);
		return () => document.removeEventListener('keydown', handleGlobalKeyDown);
	});
</script>

<div class="relative w-full">
	<div class="relative">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			{#if loading}
				<Loader2 size={20} class="animate-spin text-neutral-400" />
			{:else}
				<Search size={20} class="text-neutral-400" />
			{/if}
		</div>
		
		<input
			bind:this={inputEl}
			bind:value
			type="text"
			{placeholder}
			class="input pl-10 pr-10"
			onfocus={() => focused = true}
			onblur={() => setTimeout(() => focused = false, 200)}
			onkeydown={handleKeyDown}
			oninput={() => oninput?.(value)}
		/>
		
		<div class="absolute inset-y-0 right-0 flex items-center pr-3">
			{#if value}
				<button
					type="button"
					onclick={() => value = ''}
					class="text-neutral-400 hover:text-neutral-600 transition-colors"
				>
					<X size={20} />
				</button>
			{:else}
				<kbd class="hidden sm:inline-flex items-center gap-1 rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
					<span class="text-xs">⌘</span>K
				</kbd>
			{/if}
		</div>
	</div>
	
	<!-- Suggestions dropdown -->
	{#if showSuggestions && focused && suggestions.length > 0}
		<div class="absolute z-50 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 animate-slide-down">
			<ul class="max-h-60 overflow-auto py-1">
				{#each suggestions as suggestion}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
							onclick={() => selectSuggestion(suggestion)}
						>
							<Search size={16} class="text-neutral-400" />
							<span>{suggestion}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>