<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { ArrowLeft, Loader2, Sparkles, ChevronRight, Package } from 'lucide-svelte';
	import { io } from 'socket.io-client';
	
	interface Topic {
		id: string;
		name: string;
		description: string;
		url: string;
		priority: number;
		subtopics?: string[];
	}
	
	let loading = $state(true);
	let error = $state<string | null>(null);
	let topics = $state<Topic[]>([]);
	let framework = $state('');
	let baseUrl = $state('');
	let selectedTopic = $state<Topic | null>(null);
	
	// Real-time progress tracking
	let socket: any = null;
	let taskId = $state('');
	let progressData = $state({
		stage: 'idle',
		message: 'Starting topic discovery...',
		progress: 0,
		details: {},
		error: null,
		timestamp: null
	});
	let activityFeed = $state<any[]>([]);
	let dataFlow = $state({
		inputUrl: '',
		discoveryUrl: '',
		navigationItems: 0,
		sectionsFound: 0,
		topicsFound: 0,
		strategy: 'standard'
	});
	
	const stages = [
		{ id: 'url_analysis', name: 'URL Analysis', icon: '🔍', description: 'Analyzing URL structure' },
		{ id: 'page_fetch', name: 'Page Fetch', icon: '📥', description: 'Fetching documentation page' },
		{ id: 'navigation_extraction', name: 'Navigation Extract', icon: '🗂️', description: 'Extracting page structure' },
		{ id: 'ai_analysis', name: 'AI Analysis', icon: '🤖', description: 'Discovering topics with AI' },
		{ id: 'validation', name: 'Validation', icon: '✅', description: 'Validating discovered topics' },
		{ id: 'complete', name: 'Complete', icon: '🎉', description: 'Topic discovery finished' }
	];
	
	onMount(async () => {
		// Get URL parameters
		const url = $page.url.searchParams.get('url');
		framework = $page.url.searchParams.get('framework') || '';
		
		if (!url || !framework) {
			goto('/');
			return;
		}
		
		baseUrl = url;
		dataFlow.inputUrl = url;
		
		// Initialize WebSocket connection
		setupWebSocket();
		
		await discoverTopics(url, framework);
	});
	
	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});
	
	function setupWebSocket() {
		try {
			socket = io('http://localhost:5000');
			
			socket.on('connect', () => {
				console.log('Connected to real-time updates');
			});
			
			socket.on('topic_discovery_update', (data: any) => {
				if (data.task_id === taskId) {
					updateProgress(data);
				}
			});
			
			socket.on('disconnect', () => {
				console.log('Disconnected from real-time updates');
			});
		} catch (err) {
			console.warn('WebSocket connection failed, falling back to polling');
		}
	}
	
	function updateProgress(update: any) {
		progressData = { 
			...progressData, 
			...update, 
			timestamp: Date.now() 
		};
		
		// Add to activity feed
		if (update.message) {
			activityFeed = [
				{
					time: new Date().toLocaleTimeString(),
					stage: update.stage,
					message: update.message,
					details: update.details || {}
				},
				...activityFeed.slice(0, 9) // Keep last 10 items
			];
		}
		
		// Update data flow
		if (update.details) {
			dataFlow = { ...dataFlow, ...update.details };
		}
	}
	
	function getStageStatus(stageId: string) {
		const currentStageIndex = stages.findIndex(s => s.id === progressData.stage);
		const thisStageIndex = stages.findIndex(s => s.id === stageId);
		
		if (thisStageIndex < currentStageIndex) return 'completed';
		if (thisStageIndex === currentStageIndex) return 'active';
		return 'pending';
	}
	
	async function discoverTopics(url: string, fw: string) {
		try {
			loading = true;
			error = null;
			
			// Generate unique task ID for this discovery session
			taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			
			// Subscribe to WebSocket updates for this task
			if (socket && socket.connected) {
				socket.emit('subscribe_task', { task_id: taskId });
			}
			
			const response = await fetch('/api/discover-topics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					url, 
					framework: fw,
					task_id: taskId 
				})
			});
			
			if (!response.ok) {
				throw new Error('Failed to discover topics');
			}
			
			const data = await response.json();
			
			if (data.error) {
				throw new Error(data.error);
			}
			
			topics = data.topics || [];
			dataFlow.topicsFound = topics.length;
			
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to discover topics';
			console.error('Error discovering topics:', err);
			progressData = {
				...progressData,
				stage: 'error',
				message: 'Failed to discover topics',
				error: null
			};
		} finally {
			loading = false;
		}
	}
	
	function selectTopic(topic: Topic) {
		selectedTopic = topic;
		// Navigate to scraping page with intelligent mode
		setTimeout(() => {
			goto(`/scraping?url=${encodeURIComponent(topic.url)}&framework=${encodeURIComponent(framework)}&topic=${encodeURIComponent(topic.name)}&mode=intelligent`);
		}, 300);
	}
</script>

<div class="min-h-screen bg-[var(--color-bg-primary)]">
	<!-- Header -->
	<header class="border-b border-neutral-200 dark:border-neutral-800">
		<div class="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
			<button
				onclick={() => goto('/')}
				class="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
				aria-label="Go back"
			>
				<ArrowLeft size={20} />
			</button>
			<h1 class="text-xl font-medium">Select Documentation Topic</h1>
		</div>
	</header>
	
	<!-- Main Content -->
	<main class="max-w-4xl mx-auto px-4 py-8">
		{#if loading}
			<!-- Real-time Progress Visualization -->
			<div class="space-y-8">
				<!-- Progress Header -->
				<div class="text-center">
					<h2 class="text-2xl font-semibold mb-2">Discovering {framework} Documentation</h2>
					<p class="text-neutral-600 dark:text-neutral-400">
						Real-time analysis of documentation structure
					</p>
				</div>
				
				<!-- Progress Overview -->
				<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-medium">Progress Overview</h3>
						<span class="text-2xl font-bold text-emerald-600">{progressData.progress}%</span>
					</div>
					<div class="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-4">
						<div 
							class="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
							style="width: {progressData.progress}%"
						></div>
					</div>
					<p class="text-neutral-600 dark:text-neutral-400 text-center">
						{progressData.message}
					</p>
				</div>
				
				<!-- Processing Stages -->
				<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
					<h3 class="text-lg font-medium mb-4">Processing Stages</h3>
					<div class="space-y-3">
						{#each stages as stage}
							<div class="flex items-center gap-4 p-3 rounded-lg {getStageStatus(stage.id) === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/20' : getStageStatus(stage.id) === 'active' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800' : 'bg-neutral-50 dark:bg-neutral-800/50'}">
								<div class="text-2xl">
									{stage.icon}
								</div>
								<div class="flex-1">
									<div class="font-medium {getStageStatus(stage.id) === 'completed' ? 'text-emerald-700 dark:text-emerald-300' : getStageStatus(stage.id) === 'active' ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-500 dark:text-neutral-400'}">
										{stage.name}
									</div>
									<div class="text-sm text-neutral-600 dark:text-neutral-400">
										{stage.description}
									</div>
								</div>
								{#if getStageStatus(stage.id) === 'completed'}
									<div class="text-emerald-600 text-xl">✓</div>
								{:else if getStageStatus(stage.id) === 'active'}
									<div class="text-blue-600 text-xl animate-pulse">⟳</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Data Flow -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Data Flow Visualization -->
					<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
						<h3 class="text-lg font-medium mb-4">Data Flow</h3>
						<div class="space-y-4">
							<div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
								<div class="text-sm text-neutral-600 dark:text-neutral-400">Input URL</div>
								<div class="font-mono text-sm text-blue-600 truncate">
									{dataFlow.inputUrl || baseUrl}
								</div>
							</div>
							<div class="text-center text-2xl text-neutral-400">↓</div>
							{#if dataFlow.discoveryUrl}
								<div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
									<div class="text-sm text-neutral-600 dark:text-neutral-400">Discovery URL</div>
									<div class="font-mono text-sm text-blue-600 truncate">
										{dataFlow.discoveryUrl}
									</div>
								</div>
								<div class="text-center text-2xl text-neutral-400">↓</div>
							{/if}
							<div class="grid grid-cols-2 gap-4">
								<div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
									<div class="text-2xl font-bold text-emerald-600">{dataFlow.navigationItems}</div>
									<div class="text-sm text-neutral-600 dark:text-neutral-400">Navigation Items</div>
								</div>
								<div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
									<div class="text-2xl font-bold text-emerald-600">{dataFlow.sectionsFound}</div>
									<div class="text-sm text-neutral-600 dark:text-neutral-400">Sections Found</div>
								</div>
							</div>
							{#if dataFlow.topicsFound > 0}
								<div class="text-center text-2xl text-neutral-400">↓</div>
								<div class="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded border-2 border-emerald-200 dark:border-emerald-800">
									<div class="text-3xl font-bold text-emerald-600">{dataFlow.topicsFound}</div>
									<div class="text-sm text-emerald-700 dark:text-emerald-300">Topics Discovered</div>
								</div>
							{/if}
						</div>
					</div>
					
					<!-- Live Activity Feed -->
					<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
						<h3 class="text-lg font-medium mb-4">Live Activity Feed</h3>
						<div class="space-y-3 max-h-64 overflow-y-auto">
							{#each activityFeed as activity}
								<div class="p-3 bg-neutral-50 dark:bg-neutral-800 rounded border-l-4 border-blue-500" 
									 in:fly={{ x: -20, duration: 300 }}>
									<div class="flex justify-between items-start mb-1">
										<span class="text-sm font-medium text-blue-600 uppercase tracking-wide">
											{activity.stage?.replace('_', ' ')}
										</span>
										<span class="text-xs text-neutral-500">{activity.time}</span>
									</div>
									<div class="text-sm text-neutral-700 dark:text-neutral-300">
										{activity.message}
									</div>
									{#if activity.details && Object.keys(activity.details).length > 0}
										<div class="mt-2 flex flex-wrap gap-2">
											{#each Object.entries(activity.details) as [key, value]}
												<span class="text-xs px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded">
													{key}: {value}
												</span>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<div class="text-center text-neutral-500 py-8">
									<div class="text-4xl mb-2">📡</div>
									<div class="text-sm">Waiting for activity updates...</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{:else if error}
			<!-- Error State -->
			<div class="text-center py-12">
				<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
					<p class="text-red-700 dark:text-red-400">{error}</p>
					<button
						onclick={() => goto('/')}
						class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
					>
						Try Another Search
					</button>
				</div>
			</div>
		{:else if topics.length > 0}
			<!-- Topics Grid -->
			<div>
				<div class="text-center mb-8">
					<h2 class="text-2xl font-semibold mb-2">{framework} Documentation Topics</h2>
					<p class="text-neutral-600 dark:text-neutral-400">
						Select the specific documentation section you want to download
					</p>
				</div>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each topics as topic, i}
						<button
							onclick={() => selectTopic(topic)}
							class="group relative text-left p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg"
							in:fly={{ y: 20, delay: i * 100, duration: 500 }}
							class:ring-2={selectedTopic?.id === topic.id}
							class:ring-emerald-500={selectedTopic?.id === topic.id}
						>
							<div class="flex items-start gap-4">
								<div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors">
									<Package size={24} class="text-emerald-600 dark:text-emerald-400" />
								</div>
								
								<div class="flex-1">
									<h3 class="text-lg font-semibold mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
										{topic.name}
									</h3>
									<p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
										{topic.description}
									</p>
									
									{#if topic.subtopics && topic.subtopics.length > 0}
										<div class="flex flex-wrap gap-1.5">
											{#each topic.subtopics.slice(0, 3) as subtopic}
												<span class="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded">
													{subtopic}
												</span>
											{/each}
											{#if topic.subtopics.length > 3}
												<span class="text-xs px-2 py-1 text-neutral-500 dark:text-neutral-500">
													+{topic.subtopics.length - 3} more
												</span>
											{/if}
										</div>
									{/if}
								</div>
								
								<ChevronRight 
									size={20} 
									class="text-neutral-400 group-hover:text-emerald-500 transition-all transform group-hover:translate-x-1" 
								/>
							</div>
							
							{#if topic.priority <= 2}
								<div class="absolute top-2 right-2">
									<span class="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded">
										Popular
									</span>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- No Topics Found -->
			<div class="text-center py-12">
				<p class="text-neutral-600 dark:text-neutral-400 mb-4">
					No topics found for {framework}
				</p>
				<button
					onclick={() => goto('/')}
					class="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
				>
					Try Another Search
				</button>
			</div>
		{/if}
	</main>
</div>

