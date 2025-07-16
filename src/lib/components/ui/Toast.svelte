<script lang="ts">
	import { toast } from '$lib/stores/toast';
	import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	
	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertCircle,
		info: Info
	};
	
	const colors = {
		success: 'text-green-600 dark:text-green-400',
		error: 'text-red-600 dark:text-red-400',
		warning: 'text-amber-600 dark:text-amber-400',
		info: 'text-blue-600 dark:text-blue-400'
	};
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
	{#each $toast as item (item.id)}
		<div
			transition:fly={{ x: 100, duration: 200 }}
			class="flex items-start gap-3 rounded-lg bg-white p-4 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 dark:ring-white dark:ring-opacity-10 min-w-[300px] max-w-md"
		>
			<svelte:component this={icons[item.type]} size={20} class={colors[item.type]} />
			
			<div class="flex-1">
				<h3 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
					{item.title}
				</h3>
				{#if item.description}
					<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
						{item.description}
					</p>
				{/if}
			</div>
			
			<button
				onclick={() => toast.remove(item.id)}
				class="text-neutral-400 hover:text-neutral-500 dark:text-neutral-500 dark:hover:text-neutral-400"
			>
				<X size={18} />
			</button>
		</div>
	{/each}
</div>