<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { 
		Search, 
		Download, 
		ExternalLink, 
		FolderPlus, 
		ChevronDown,
		Sparkles,
		Code2,
		BookOpen
	} from 'lucide-svelte';
	
	// UI Components
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import DownloadQueue from '$lib/components/ui/DownloadQueue.svelte';
	import ConnectionStatus from '$lib/components/ui/ConnectionStatus.svelte';
	
	// Stores
	import { toast } from '$lib/stores/toast';
	import { websocket } from '$lib/stores/websocket';
	
	interface DocLink {
		title: string;
		url: string;
		type: 'official' | 'tutorial' | 'api' | 'reference' | 'github';
		description?: string;
	}
	
	interface SearchResult {
		framework: string;
		links: DocLink[];
		timestamp: Date;
	}
	
	let searchQuery = $state('');
	let searchResults = $state<SearchResult | null>(null);
	let recentSearches = $state<SearchResult[]>([]);
	let loading = $state(false);
	let selectedFolder = $state<string>('');
	let availableFolders = $state<string[]>([]);
	let showCreateFolder = $state(false);
	let newFolderName = $state('');
	let showFolderDropdown = $state(false);
	
	// Popular frameworks for suggestions
	const popularFrameworks = [
		'React', 'Vue', 'Angular', 'Svelte', 'Next.js',
		'Django', 'Flask', 'FastAPI', 'Express', 'Spring Boot'
	];
	
	let suggestions = $state<string[]>([]);
	
	onMount(() => {
		// Connect to WebSocket
		websocket.connect();

		// Load recent searches from localStorage
		const saved = localStorage.getItem('recentSearches');
		if (saved) {
			try {recentSearches = JSON.parse(saved);} 
			catch (e) {console.error('Failed to parse recent searches:', e);}
		}
		loadFolders();
		return () => {
			websocket.disconnect();
		};
	});
	
	async function searchDocumentation() {
		if (!searchQuery.trim()) {
			toast.warning('Please enter a framework or tool name');
			return;
		}
		
		loading = true;
		searchResults = null;
		
		try {
			const response = await fetch(`/api/search-docs?q=${encodeURIComponent(searchQuery)}`);
			
			if (!response.ok) {
				throw new Error('Failed to search documentation');
			}
			
			const data = await response.json();
			searchResults = {
				framework: searchQuery,
				links: data.links,
				timestamp: new Date()
			};
			
			// Add to recent searches
			recentSearches = [searchResults, ...recentSearches.filter(s => s.framework !== searchQuery)].slice(0, 5);
			localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
			
			toast.success(`Found ${data.links.length} documentation links for ${searchQuery}`);
			
		} catch (err) {
			console.error('Search error:', err);
			toast.error('Failed to search for documentation', 'Please check your connection and try again.');
		} finally {
			loading = false;
		}
	}
	
	function handleSearchInput(value: string) {
		// Filter suggestions based on input
		if (value.trim()) {
			suggestions = popularFrameworks
				.filter(fw => fw.toLowerCase().includes(value.toLowerCase()))
				.slice(0, 5);
		} else {
			suggestions = [];
		}
	}
	
	async function loadFolders() {
		try {
			const response = await fetch('/api/folders');
			if (response.ok) {
				const data = await response.json();
				availableFolders = data.folders.map((f: any) => f.name);
			}
		} catch (err) {
			console.error('Failed to load folders:', err);
		}
	}
	
	async function createFolder() {
		if (!newFolderName.trim()) {
			toast.warning('Please enter a folder name');
			return;
		}
		
		try {
			const response = await fetch('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newFolderName })
			});
			
			if (response.ok) {
				await loadFolders();
				selectedFolder = newFolderName;
				newFolderName = '';
				showCreateFolder = false;
				toast.success('Folder created successfully');
			} else {
				const data = await response.json();
				toast.error(data.error || 'Failed to create folder');
			}
		} catch (err) {
			toast.error('Failed to create folder');
		}
	}
	
	async function scrapeDocumentation(link: DocLink) {
		if (!selectedFolder) {
			toast.warning('Please select a folder first', 'Choose where to save the documentation');
			return;
		}
		
		try {
			const response = await fetch('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: link.url,
					folder: selectedFolder,
					framework: searchResults?.framework || 'unknown'
				})
			});
			
			if (response.ok) {
				const data = await response.json();
				toast.success(
					'Download started!', 
					`Scraping ${link.title} to ${selectedFolder} folder`
				);
				
				// Subscribe to task updates
				if (data.task_id) {
					websocket.subscribeToTask(data.task_id);
				}
			} else {
				toast.error('Failed to start download');
			}
		} catch (err) {
			toast.error('Failed to scrape documentation');
		}
	}
</script>

<div class="min-h-screen bg-[var(--color-bg-primary)]">
	<!-- Header -->
	<header class="border-b bg-[var(--color-bg-secondary)]">
		<div class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="rounded-lg bg-brand p-2">
						<BookOpen size={24} class="text-white" />
					</div>
					<div>
						<h1 class="text-xl font-semibold text-[var(--color-text-primary)]">
							DevDocs Scraper
						</h1>
						<p class="text-sm text-[var(--color-text-secondary)]">
							Search and download documentation for any framework
						</p>
					</div>
				</div>
				
				<div class="flex items-center gap-4">
					<ConnectionStatus />
					<ThemeToggle />
				</div>
			</div>
		</div>
	</header>
	
	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8">
		<!-- Search Section -->
		<div class="mb-12 text-center">
			<div class="mb-8">
				<h2 class="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">
					Find Documentation Instantly
				</h2>
				<p class="text-lg text-[var(--color-text-secondary)]">
					Search for any framework, library, or tool
				</p>
			</div>
			
			<div class="mx-auto max-w-2xl space-y-4">
				<form onsubmit={(e) => { e.preventDefault(); searchDocumentation(); }}>
					<div class="flex gap-3">
						<div class="flex-1">
							<SearchInput
								bind:value={searchQuery}
								placeholder="Search for React, Django, Flutter..."
								{loading}
								{suggestions}
								showSuggestions={true}
								onsearch={() => searchDocumentation()}
								oninput={handleSearchInput}
							/>
						</div>
						<Button 
							type="submit"
							{loading}
							onclick={searchDocumentation}
						>
							<Search size={20} />
							Search
						</Button>
					</div>
				</form>
				
				<!-- Folder Selection -->
				<div class="relative">
					<button
						type="button"
						onclick={() => showFolderDropdown = !showFolderDropdown}
						class="flex w-full items-center justify-between rounded-md border border-scale-300 bg-white px-4 py-2.5 text-left text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-scale-700 dark:bg-scale-900"
					>
						<span class="flex items-center gap-2">
							<FolderPlus size={18} class="text-scale-500" />
							{#if selectedFolder}
								<span class="text-[var(--color-text-primary)]">{selectedFolder}</span>
							{:else}
								<span class="text-scale-500">Select a folder to save documentation</span>
							{/if}
						</span>
						<ChevronDown size={18} class="text-scale-400" />
					</button>
					
					{#if showFolderDropdown}
						<div 
							class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-scale-800 animate-slide-down"
							transition:fly={{ y: -10, duration: 200 }}
						>
							<div class="py-1">
								{#each availableFolders as folder}
									<button
										type="button"
										class="flex w-full items-center px-4 py-2 text-sm text-scale-700 hover:bg-scale-100 dark:text-scale-300 dark:hover:bg-scale-700"
										onclick={() => { selectedFolder = folder; showFolderDropdown = false; }}
									>
										{folder}
									</button>
								{/each}
								
								<div class="border-t border-scale-200 dark:border-scale-700">
									<button
										type="button"
										class="flex w-full items-center gap-2 px-4 py-2 text-sm text-brand hover:bg-scale-100 dark:hover:bg-scale-700"
										onclick={() => { showCreateFolder = true; showFolderDropdown = false; }}
									>
										<FolderPlus size={16} />
										Create new folder
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
				
				<!-- Create Folder Form -->
				{#if showCreateFolder}
					<div 
						class="rounded-md border border-scale-300 bg-scale-50 p-4 dark:border-scale-700 dark:bg-scale-800"
						transition:fly={{ y: -10, duration: 200 }}
					>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newFolderName}
								placeholder="Enter folder name"
								class="input flex-1"
								onkeypress={(e) => e.key === 'Enter' && createFolder()}
							/>
							<Button onclick={createFolder} size="sm">
								Create
							</Button>
							<Button 
								variant="ghost" 
								size="sm"
								onclick={() => { showCreateFolder = false; newFolderName = ''; }}
							>
								Cancel
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Search Results -->
		{#if loading}
			<div class="mx-auto max-w-4xl">
				<div class="grid gap-4 md:grid-cols-2">
					{#each Array(4) as _}
						<Card>
							<div class="space-y-3">
								<Skeleton width="80px" height="24px" />
								<Skeleton width="100%" height="20px" />
								<Skeleton width="100%" height="40px" />
								<div class="flex gap-2">
									<Skeleton width="100px" height="36px" />
									<Skeleton width="100px" height="36px" />
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</div>
		{:else if searchResults}
			<div class="mx-auto max-w-4xl" transition:fade={{ duration: 200 }}>
				<h3 class="mb-6 text-xl font-semibold text-[var(--color-text-primary)]">
					Documentation for {searchResults.framework}
				</h3>
				
				<div class="grid gap-4 md:grid-cols-2">
					{#each searchResults.links as link, i}
						<div transition:fly={{ y: 20, delay: i * 50, duration: 300 }}>
							<Card hover>
								<div class="space-y-3">
									<div class="flex items-start justify-between">
										<Badge type={link.type} />
										<ExternalLink size={16} class="text-scale-400" />
									</div>
									
									<div>
										<h4 class="font-semibold text-[var(--color-text-primary)]">
											{link.title}
										</h4>
										{#if link.description}
											<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
												{link.description}
											</p>
										{/if}
									</div>
									
									<div class="flex gap-2">
										<Button
											variant="secondary"
											size="sm"
											onclick={() => window.open(link.url, '_blank')}
										>
											<ExternalLink size={16} />
											View Online
										</Button>
										<Button
											variant="primary"
											size="sm"
											onclick={() => scrapeDocumentation(link)}
										>
											<Download size={16} />
											Download
										</Button>
									</div>
								</div>
							</Card>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Recent Searches -->
		{#if recentSearches.length > 0 && !loading && !searchResults}
			<div class="mx-auto max-w-4xl">
				<h3 class="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
					Recent Searches
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each recentSearches as search}
						<button
							onclick={() => { searchQuery = search.framework; searchDocumentation(); }}
							class="inline-flex items-center gap-2 rounded-full border border-scale-300 bg-white px-4 py-2 text-sm text-scale-700 transition-colors hover:bg-scale-100 hover:text-scale-900 dark:border-scale-700 dark:bg-scale-800 dark:text-scale-300 dark:hover:bg-scale-700"
						>
							<Code2 size={16} />
							{search.framework}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Empty State -->
		{#if !loading && !searchResults && recentSearches.length === 0}
			<div class="mx-auto max-w-md text-center">
				<div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
					<Sparkles size={40} class="text-brand" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
					Start Your Search
				</h3>
				<p class="mb-6 text-[var(--color-text-secondary)]">
					Search for any framework or library to find and download its documentation
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					{#each popularFrameworks.slice(0, 5) as framework}
						<button
							onclick={() => { searchQuery = framework; searchDocumentation(); }}
							class="rounded-full bg-scale-100 px-3 py-1 text-sm text-scale-700 hover:bg-scale-200 dark:bg-scale-800 dark:text-scale-300 dark:hover:bg-scale-700"
						>
							{framework}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Click outside handlers -->
{#if showFolderDropdown}
	<button
		class="fixed inset-0 z-0"
		onclick={() => showFolderDropdown = false}
		aria-hidden="true"
	></button>
{/if}

<!-- Toast Notifications -->
<Toast />

<!-- Download Queue -->
<DownloadQueue />