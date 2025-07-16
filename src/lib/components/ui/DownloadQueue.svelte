<script lang="ts">
	import { activeDownloads, queuedDownloads, isConnected } from '$lib/stores/websocket';
	import { slide } from 'svelte/transition';
	import { Download, Wifi, WifiOff } from 'lucide-svelte';
	import DownloadProgress from './DownloadProgress.svelte';
	
	let isExpanded = $state(true);
</script>

{#if $activeDownloads.length > 0 || $queuedDownloads.length > 0}
	<div class="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)]">
		<div class="rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 dark:ring-white dark:ring-opacity-10">
			<!-- Header -->
			<button
				onclick={() => isExpanded = !isExpanded}
				class="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
			>
				<div class="flex items-center gap-3">
					<Download size={20} class="text-emerald-500" />
					<div>
						<h3 class="text-sm font-semibold text-[var(--color-text-primary)]">
							Downloads
						</h3>
						<p class="text-xs text-neutral-600 dark:text-neutral-400">
							{$activeDownloads.length} active, {$queuedDownloads.length} queued
						</p>
					</div>
				</div>
				
				<div class="flex items-center gap-2">
					{#if $isConnected}
						<Wifi size={16} class="text-green-600 dark:text-green-400" />
					{:else}
						<WifiOff size={16} class="text-red-600 dark:text-red-400" />
					{/if}
					
					<svg
						class="h-5 w-5 text-neutral-400 transition-transform"
						class:rotate-180={!isExpanded}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</div>
			</button>
			
			<!-- Content -->
			{#if isExpanded}
				<div 
					class="max-h-[60vh] overflow-y-auto border-t border-neutral-200 dark:border-neutral-700"
					transition:slide={{ duration: 200 }}
				>
					<div class="space-y-2 p-4">
						<!-- Active Downloads -->
						{#if $activeDownloads.length > 0}
							<div>
								<h4 class="mb-2 text-xs font-medium uppercase text-neutral-500">
									Active Downloads
								</h4>
								<div class="space-y-2">
									{#each $activeDownloads as task (task.id)}
										<div transition:slide={{ duration: 200 }}>
											<DownloadProgress {task} />
										</div>
									{/each}
								</div>
							</div>
						{/if}
						
						<!-- Queued Downloads -->
						{#if $queuedDownloads.length > 0}
							<div class="mt-4">
								<h4 class="mb-2 text-xs font-medium uppercase text-neutral-500">
									Queued
								</h4>
								<div class="space-y-2">
									{#each $queuedDownloads as task (task.id)}
										<div transition:slide={{ duration: 200 }}>
											<DownloadProgress {task} />
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}