<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	
	export let taskId: string | null = null;
	export let visible = false;
	
	const dispatch = createEventDispatcher();
	
	interface ProgressData {
		stage: string;
		message: string;
		progress: number;
		details?: Record<string, any>;
		error?: string | null;
		timestamp?: number | null;
	}
	
	let progressData: ProgressData = {
		stage: 'idle',
		message: 'Ready to start',
		progress: 0,
		details: {},
		error: null,
		timestamp: null
	};
	
	let stages = [
		{ id: 'url_analysis', name: 'URL Analysis', icon: '🔍' },
		{ id: 'page_fetch', name: 'Page Fetch', icon: '📥' },
		{ id: 'navigation_extraction', name: 'Navigation Extract', icon: '🗂️' },
		{ id: 'ai_analysis', name: 'AI Analysis', icon: '🤖' },
		{ id: 'validation', name: 'Validation', icon: '✅' },
		{ id: 'complete', name: 'Complete', icon: '🎉' }
	];
	
	onMount(() => {
		if (typeof window !== 'undefined' && taskId) {
			// In a real implementation, this would connect to the actual SSE endpoint
			// For now, just simulate some progress
			simulateProgress();
		}
	});
	
	function simulateProgress() {
		let currentStage = 0;
		const interval = setInterval(() => {
			if (currentStage < stages.length) {
				progressData = {
					stage: stages[currentStage].id,
					message: `Processing ${stages[currentStage].name}...`,
					progress: ((currentStage + 1) / stages.length) * 100,
					timestamp: Date.now()
				};
				currentStage++;
			} else {
				clearInterval(interval);
				progressData = {
					stage: 'complete',
					message: 'All done!',
					progress: 100,
					timestamp: Date.now()
				};
			}
		}, 1500);
	}
	
	function handleClose() {
		dispatch('close');
	}
</script>

{#if visible}
	<div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" transition:fade>
		<article class="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<header class="flex items-center justify-between mb-6">
				<h2>Progress Dashboard</h2>
				<button type="button" class="bg-transparent text-neutral-700 hover:bg-neutral-100 focus:ring-neutral-500 dark:text-neutral-300 dark:hover:bg-neutral-800" on:click={handleClose}>
					<span class="sr-only">Close</span>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</header>
			
			<div class="space-y-4">
				<!-- Progress Bar -->
				<div class="w-full bg-neutral-200 rounded-full h-2 dark:bg-neutral-700">
					<div 
						class="bg-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
						style="width: {progressData.progress}%"
					></div>
				</div>
				
				<!-- Current Status -->
				<div class="text-center">
					<h3>{progressData.message}</h3>
					<p>{Math.round(progressData.progress)}% complete</p>
				</div>
				
				<!-- Stages -->
				<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
					{#each stages as stage, index}
						<article class="text-center">
							<div class="text-2xl mb-2">{stage.icon}</div>
							<h4>{stage.name}</h4>
							<small class={
								progressData.stage === stage.id ? 'text-emerald-600 dark:text-emerald-400' :
								stages.findIndex(s => s.id === progressData.stage) > index ? 'text-emerald-600 dark:text-emerald-400' :
								'text-neutral-500'
							}>
								{progressData.stage === stage.id ? 'In Progress' :
								 stages.findIndex(s => s.id === progressData.stage) > index ? 'Complete' :
								 'Pending'}
							</small>
						</article>
					{/each}
				</div>
				
				{#if progressData.error}
					<article class="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
						<h4 class="text-red-800 dark:text-red-200">Error</h4>
						<p class="text-red-600 dark:text-red-300">{progressData.error}</p>
					</article>
				{/if}
			</div>
		</article>
	</div>
{/if}