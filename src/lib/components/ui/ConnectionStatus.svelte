<script lang="ts">
	import { isConnected } from '$lib/stores/websocket';
	import { Wifi, WifiOff } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
</script>

<div class="flex items-center gap-2">
	{#if $isConnected}
		<div 
			class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
			transition:fade={{ duration: 200 }}
		>
			<Wifi size={14} />
			<span>Connected</span>
		</div>
	{:else}
		<div 
			class="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
			transition:fade={{ duration: 200 }}
		>
			<WifiOff size={14} />
			<span>Disconnected</span>
		</div>
	{/if}
</div>