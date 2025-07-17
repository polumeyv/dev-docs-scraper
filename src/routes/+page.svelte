<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { 
		Search, 
		Download, 
		ExternalLink, 
		FolderPlus, 
		ChevronDown,
		Code2
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
	
	// Request management
	let activeRequests = new Set<AbortController>();
	
	// API helper function with timeout and error handling
	async function apiRequest(url: string, options: RequestInit = {}) {
		const controller = new AbortController();
		activeRequests.add(controller);
		
		// Set up timeout
		const timeout = setTimeout(() => {
			controller.abort();
		}, 10000); // 10 second timeout
		
		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			
			clearTimeout(timeout);
			activeRequests.delete(controller);
			
			// Handle response based on the new API format
			const data = await response.json();
			
			if (!response.ok) {
				// Extract error message from standardized error format
				const errorMessage = data.error || `HTTP ${response.status}`;
				const errorDetails = data.details ? `: ${data.details}` : '';
				throw new Error(`${errorMessage}${errorDetails}`);
			}
			
			return data;
			
		} catch (error) {
			clearTimeout(timeout);
			activeRequests.delete(controller);
			
			if (error.name === 'AbortError') {
				throw new Error('Request timed out. Please check your connection and try again.');
			}
			
			throw error;
		}
	}
	
	onMount(() => {
		// Connect to WebSocket
		websocket.connect();

		// Load recent searches from localStorage
		const saved = localStorage.getItem('recentSearches');
		if (saved) {
			try {
				recentSearches = JSON.parse(saved);
			} catch (e) {
				console.error('Failed to parse recent searches:', e);
				// Clear corrupted data
				localStorage.removeItem('recentSearches');
			}
		}
		
		// Load folders with error handling
		loadFolders().catch(err => {
			console.error('Initial folder loading failed:', err);
		});
	});
	
	onDestroy(() => {
		// Cancel all active requests
		activeRequests.forEach(controller => {
			controller.abort();
		});
		activeRequests.clear();
		
		// Disconnect WebSocket
		websocket.disconnect();
	});
	
	async function searchDocumentation() {
		if (!searchQuery.trim()) {
			toast.warning('Please enter a framework or tool name');
			return;
		}
		
		loading = true;
		searchResults = null;
		
		try {
			const data = await apiRequest(`/api/search-docs?q=${encodeURIComponent(searchQuery)}`);
			
			// Handle the standardized API response format
			const responseData = data.data || data; // Support both old and new formats
			
			// Check if we have valid data
			if (!responseData.links || !Array.isArray(responseData.links)) {
				throw new Error('No documentation links found for this framework');
			}
			
			searchResults = {
				framework: responseData.framework || searchQuery,
				links: responseData.links,
				timestamp: new Date()
			};
			
			// Add to recent searches
			recentSearches = [searchResults, ...recentSearches.filter(s => s.framework !== searchQuery)].slice(0, 5);
			
			try {
				localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
			} catch (e) {
				console.warn('Failed to save recent searches to localStorage:', e);
			}
			
			toast.success(`Found ${responseData.links.length} documentation link${responseData.links.length !== 1 ? 's' : ''} for ${searchQuery}`);
			
		} catch (err) {
			console.error('Search error:', err);
			const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
			
			if (errorMessage.includes('timeout')) {
				toast.error('Search timed out', 'The search is taking longer than expected. Please try again.');
			} else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
				toast.error('Network error', 'Please check your internet connection and try again.');
			} else {
				toast.error('Search failed', errorMessage);
			}
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
			const data = await apiRequest('/api/folders');
			
			// Handle the standardized API response format
			const responseData = data.data || data; // Support both old and new formats
			
			if (responseData.folders && Array.isArray(responseData.folders)) {
				availableFolders = responseData.folders.map((f: any) => f.name);
			} else {
				// Initialize with default folder if no folders found
				availableFolders = ['documentation'];
			}
		} catch (err) {
			console.error('Failed to load folders:', err);
			const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
			
			// Don't show error toast for folder loading since it's not critical
			// Just initialize with default folder
			availableFolders = ['documentation'];
			
			// Only log specific error types
			if (!errorMessage.includes('timeout')) {
				console.warn('Folder loading error:', errorMessage);
			}
		}
	}
	
	async function createFolder() {
		if (!newFolderName.trim()) {
			toast.warning('Please enter a folder name');
			return;
		}
		
		try {
			const data = await apiRequest('/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newFolderName })
			});
			
			// Handle the standardized API response format
			const responseData = data.data || data;
			
			// Reload folders to get the updated list
			await loadFolders();
			
			// Set the newly created folder as selected
			selectedFolder = responseData.name || newFolderName;
			newFolderName = '';
			showCreateFolder = false;
			
			toast.success('Folder created successfully');
			
		} catch (err) {
			console.error('Failed to create folder:', err);
			const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
			
			if (errorMessage.includes('already exists')) {
				toast.error('Folder already exists', 'Please choose a different name.');
			} else if (errorMessage.includes('timeout')) {
				toast.error('Request timed out', 'Please try again.');
			} else if (errorMessage.includes('Permission denied')) {
				toast.error('Permission denied', 'Unable to create folder. Please check permissions.');
			} else {
				toast.error('Failed to create folder', errorMessage);
			}
		}
	}
	
	async function scrapeDocumentation(link: DocLink) {
		if (!selectedFolder) {
			toast.warning('Please select a folder first', 'Choose where to save the documentation');
			return;
		}
		
		try {
			const data = await apiRequest('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: link.url,
					folder: selectedFolder,
					framework: searchResults?.framework || 'unknown'
				})
			});
			
			// Handle the standardized API response format
			const responseData = data.data || data;
			
			toast.success(
				'Download started!', 
				`Scraping ${link.title} to ${selectedFolder} folder`
			);
			
			// Subscribe to task updates
			if (responseData.task_id) {
				try {
					websocket.subscribeToTask(responseData.task_id);
				} catch (wsError) {
					console.warn('Failed to subscribe to task updates:', wsError);
					// Don't show error to user as the task will still run
				}
			}
			
		} catch (err) {
			console.error('Failed to scrape documentation:', err);
			const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
			
			if (errorMessage.includes('timeout')) {
				toast.error('Request timed out', 'Please try again or check your connection.');
			} else if (errorMessage.includes('validation failed')) {
				toast.error('Invalid request', 'Please check the URL and try again.');
			} else if (errorMessage.includes('Configuration error')) {
				toast.error('Service unavailable', 'The scraping service is not properly configured.');
			} else {
				toast.error('Failed to start download', errorMessage);
			}
		}
	}
</script>

<div class="min-h-screen bg-[var(--color-bg-primary)]">
	<!-- Header -->
	<header class="border-b bg-[var(--color-bg-secondary)]">
		<div class="container mx-auto px-4 py-2">
			<div class="flex items-center justify-end gap-4">
				<ConnectionStatus />
				<ThemeToggle />
			</div>
		</div>
	</header>
	
	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8">
		<!-- Search Section -->
		<div class="mb-12">
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
						class="flex w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-left text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900"
					>
						<span class="flex items-center gap-2">
							<FolderPlus size={18} class="text-neutral-500" />
							{#if selectedFolder}
								<span class="text-[var(--color-text-primary)]">{selectedFolder}</span>
							{:else}
								<span class="text-neutral-500">Select a folder to save documentation</span>
							{/if}
						</span>
						<ChevronDown size={18} class="text-neutral-400" />
					</button>
					
					{#if showFolderDropdown}
						<div 
							class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 animate-slide-down"
							transition:fly={{ y: -10, duration: 200 }}
						>
							<div class="py-1">
								{#each availableFolders as folder}
									<button
										type="button"
										class="flex w-full items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
										onclick={() => { selectedFolder = folder; showFolderDropdown = false; }}
									>
										{folder}
									</button>
								{/each}
								
								<div class="border-t border-neutral-200 dark:border-neutral-700">
									<button
										type="button"
										class="flex w-full items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
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
						class="rounded-md border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800"
						transition:fly={{ y: -10, duration: 200 }}
					>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newFolderName}
								placeholder="Enter folder name"
								class="flex-1"
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
										<ExternalLink size={16} class="text-neutral-400" />
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
							class="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
						>
							<Code2 size={16} />
							{search.framework}
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