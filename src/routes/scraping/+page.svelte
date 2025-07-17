<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { scraping } from '$lib/stores/scraping';
	import { fade, fly } from 'svelte/transition';
	import { ArrowLeft, Loader2, CheckCircle, XCircle, FileText } from 'lucide-svelte';
	
	let task = $state<any>(null);
	
	// Subscribe to scraping store
	$effect(() => {
		const unsubscribe = scraping.subscribe(value => {
			task = value;
		});
		
		return unsubscribe;
	});
	
	onMount(() => {
		// Get URL parameters
		const url = $page.url.searchParams.get('url');
		const framework = $page.url.searchParams.get('framework');
		const topic = $page.url.searchParams.get('topic');
		const mode = $page.url.searchParams.get('mode') || 'intelligent';
		
		if (!url || !framework) {
			goto('/');
			return;
		}
		
		// Connect WebSocket and start scraping
		scraping.connect();
		scraping.startScraping(url, framework, topic || undefined, mode);
	});
	
	onDestroy(() => {
		scraping.disconnect();
		scraping.reset();
	});
</script>

<div class="min-h-screen bg-[var(--color-bg-primary)]">
	<!-- Header -->
	<header class="border-b border-neutral-200 dark:border-neutral-800">
		<div class="max-w-4xl mx-auto px-4 py-2">
			<button
				onclick={() => goto('/')}
				class="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
				aria-label="Go back"
			>
				<ArrowLeft size={20} />
			</button>
		</div>
	</header>
	
	<!-- Main Content -->
	<main class="max-w-4xl mx-auto px-4 py-8">
		{#if task}
			<div class="space-y-8">
				<!-- Status Header -->
				<div class="text-center">
					<div class="inline-flex items-center justify-center mb-4">
						{#if task.status === 'completed'}
							<CheckCircle size={48} class="text-green-500" />
						{:else if task.status === 'error'}
							<XCircle size={48} class="text-red-500" />
						{:else}
							<Loader2 size={48} class="text-blue-500 animate-spin" />
						{/if}
					</div>
					
					<h2 class="text-2xl font-semibold mb-2">
						{task.topic_name || task.framework} Documentation
					</h2>
					
					<p class="text-lg text-neutral-600 dark:text-neutral-400">
						{task.message}
					</p>
				</div>
				
				<!-- Progress Bar -->
				{#if task.status !== 'completed' && task.status !== 'error'}
					<div class="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
						<div 
							class="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
							style="width: {task.progress}%"
						></div>
					</div>
				{/if}
				
				<!-- Phase Information -->
				{#if task.phase}
					<div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 mb-6">
						<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Current Phase:</p>
						<p class="font-medium">
							{#if task.phase === 'route_analysis'}
								🔍 Analyzing Documentation Structure
							{:else if task.phase === 'layout_detection'}
								🎨 Detecting Layout Patterns
							{:else if task.phase === 'content_extraction'}
								📝 Extracting Content
							{:else}
								{task.phase}
							{/if}
						</p>
						
						{#if task.layout_detected}
							<p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
								✅ Layout patterns detected - content will be cleaned intelligently
							</p>
						{/if}
					</div>
				{/if}
				
				<!-- Statistics -->
				{#if task.total_pages || task.total_routes}
					<div class="grid grid-cols-2 gap-4 text-center">
						<div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-6">
							<div class="text-3xl font-bold text-blue-500 mb-1">
								{task.pages_scraped || 0}
							</div>
							<div class="text-sm text-neutral-600 dark:text-neutral-400">
								Pages Scraped
							</div>
						</div>
						<div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-6">
							<div class="text-3xl font-bold text-emerald-500 mb-1">
								{task.total_pages || task.total_routes || 0}
							</div>
							<div class="text-sm text-neutral-600 dark:text-neutral-400">
								{task.total_routes ? 'Unique Routes' : 'Total Pages'}
							</div>
						</div>
					</div>
				{/if}
				
				<!-- Current Page -->
				{#if task.current_page && task.status === 'scraping'}
					<div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
						<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Currently scraping:</p>
						<p class="text-sm font-mono truncate">{task.current_page}</p>
					</div>
				{/if}
				
				<!-- Content Preview -->
				{#if task.current_content}
					<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 mb-6">
						<div class="flex items-start gap-3">
							<FileText size={20} class="text-emerald-500 mt-0.5 flex-shrink-0" />
							<div class="flex-1 min-w-0">
								<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Latest extraction:</p>
								<h4 class="font-medium mb-1 truncate">{task.current_content.title || 'Untitled'}</h4>
								<p class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
									{task.current_content.preview || task.current_content.content || 'Processing...'}
								</p>
								{#if task.current_content.sections}
									<p class="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
										{task.current_content.sections} sections, {task.current_content.code_examples || 0} code examples
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				
				<!-- Organized Content Summary -->
				{#if task.organized_content}
					<div>
						<h3 class="text-lg font-semibold mb-4">Content Summary</h3>
						<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Content</p>
									<p class="text-2xl font-bold text-emerald-500">
										{task.organized_content.total_words?.toLocaleString() || 0} words
									</p>
									<p class="text-sm text-neutral-500">
										from {task.organized_content.total_pages || 0} pages
									</p>
								</div>
								
								{#if task.organized_content.table_of_contents}
									<div>
										<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Content Types</p>
										<div class="space-y-1">
											{#each task.organized_content.table_of_contents as section}
												<div class="flex justify-between text-sm">
													<span class="capitalize">{section.type.replace('_', ' ')}</span>
													<span class="text-neutral-500">{section.count}</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				
				<!-- Error Message -->
				{#if task.status === 'error' && task.error}
					<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<p class="text-red-700 dark:text-red-400">{task.error}</p>
					</div>
				{/if}
				
				<!-- Completion Actions -->
				{#if task.status === 'completed'}
					<div class="flex justify-center gap-4">
						<button
							onclick={() => goto('/')}
							class="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
						>
							Search Again
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Loading State -->
			<div class="text-center py-12">
				<Loader2 size={48} class="mx-auto mb-4 animate-spin text-neutral-400" />
				<p class="text-neutral-600 dark:text-neutral-400">Initializing scraper...</p>
			</div>
		{/if}
	</main>
</div>

