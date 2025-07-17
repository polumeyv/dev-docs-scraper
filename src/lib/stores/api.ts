import { writable, derived } from 'svelte/store';

export interface DownloadTask {
	id: string;
	url: string;
	framework: string;
	topic_name?: string;
	mode: 'intelligent' | 'basic';
	status: 'queued' | 'in_progress' | 'completed' | 'error';
	progress: number;
	message: string;
	pagesScraped?: number;
	totalPages?: number;
	error?: string;
	createdAt: string;
}

interface ApiState {
	connected: boolean;
	activeTasks: DownloadTask[];
	eventSources: Map<string, EventSource>;
}

function createApiStore() {
	const { subscribe, update } = writable<ApiState>({
		connected: true, // Always connected in SvelteKit
		activeTasks: [],
		eventSources: new Map()
	});
	
	// Request management
	const activeRequests = new Set<AbortController>();
	
	
	// API helper function with timeout and error handling
	async function apiRequest(url: string, options: RequestInit = {}) {
		const controller = new AbortController();
		activeRequests.add(controller);
		
		// Set up timeout (10s for most requests, 15s for topic discovery)
		const timeout = setTimeout(() => {
			controller.abort();
		}, url.includes('discover-topics') ? 15000 : 10000);
		
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
			
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('Request timed out. Please check your connection and try again.');
			}
			
			throw error;
		}
	}

	return {
		subscribe,

		// Search for documentation
		async searchDocumentation(framework: string) {
			try {
				const data = await apiRequest(`/api/search-docs?q=${encodeURIComponent(framework)}`);
				// Handle the standardized API response format
				return data.data || data; // Support both old and new formats
			} catch (error) {
				console.error('Search documentation error:', error);
				throw error;
			}
		},

		// Discover topics
		async discoverTopics(url: string, framework: string, taskId?: string) {
			try {
				const data = await apiRequest('/api/discover-topics', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url, framework, task_id: taskId })
				});
				// Handle the standardized API response format
				return data.data || data; // Support both old and new formats
			} catch (error) {
				console.error('Discover topics error:', error);
				throw error;
			}
		},

		// Start scraping
		async startScraping(url: string, framework: string, topicName?: string, mode: 'intelligent' | 'basic' = 'intelligent') {
			try {
				const data = await apiRequest('/api/scrape', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						url, 
						framework, 
						topic_name: topicName,
						mode 
					})
				});
				
				// Handle the standardized API response format
				const result = data.data || data; // Support both old and new formats
				
				if (result.task_id) {
					// Start listening for updates
					this.subscribeToTask(result.task_id);
				}
				
				return result;
			} catch (error) {
				console.error('Start scraping error:', error);
				throw error;
			}
		},

		// Subscribe to task updates via SSE
		subscribeToTask(taskId: string) {
			update(state => {
				// Don't create duplicate event sources
				if (state.eventSources.has(taskId)) {
					return state;
				}

				try {
					const eventSource = new EventSource(`/api/sse?task_id=${taskId}`);
					
					eventSource.onopen = () => {
						console.log(`SSE connection opened for task ${taskId}`);
					};
					
					eventSource.onmessage = (event) => {
						try {
							const data = JSON.parse(event.data);
							
							if (data.type === 'task_update') {
								this.updateTask(taskId, data);
							}
						} catch (error) {
							console.error('Error parsing SSE message:', error);
							// Don't close connection for parsing errors
						}
					};

					eventSource.onerror = (error) => {
						console.error('SSE error for task', taskId, error);
						
						// Check if the error is due to connection loss
						if (eventSource.readyState === EventSource.CLOSED) {
							console.log(`SSE connection closed for task ${taskId}`);
						} else if (eventSource.readyState === EventSource.CONNECTING) {
							console.log(`SSE reconnecting for task ${taskId}`);
							// Let it try to reconnect automatically
							return;
						}
						
						// Clean up on permanent error
						eventSource.close();
						update(state => {
							state.eventSources.delete(taskId);
							return state;
						});
					};

					state.eventSources.set(taskId, eventSource);
				} catch (error) {
					console.error(`Failed to create SSE connection for task ${taskId}:`, error);
					// Continue without SSE - polling can be used as fallback
				}
				
				return state;
			});
		},

		// Update a specific task
		updateTask(taskId: string, updates: Partial<DownloadTask>) {
			update(state => {
				const existingIndex = state.activeTasks.findIndex(t => t.id === taskId);
				
				if (existingIndex >= 0) {
					// Update existing task
					state.activeTasks[existingIndex] = {
						...state.activeTasks[existingIndex],
						...updates
					};
				} else {
					// Add new task
					const newTask: DownloadTask = {
						id: taskId,
						url: '',
						framework: '',
						mode: 'intelligent',
						status: 'queued',
						progress: 0,
						message: '',
						createdAt: new Date().toISOString(),
						...updates
					};
					state.activeTasks.push(newTask);
				}

				// Close event source if task is completed or errored
				if (updates.status === 'completed' || updates.status === 'error') {
					const eventSource = state.eventSources.get(taskId);
					if (eventSource) {
						eventSource.close();
						state.eventSources.delete(taskId);
					}
				}

				return state;
			});
		},

		// Remove a task
		removeTask(taskId: string) {
			update(state => {
				// Close event source
				const eventSource = state.eventSources.get(taskId);
				if (eventSource) {
					eventSource.close();
					state.eventSources.delete(taskId);
				}

				// Remove from active tasks
				state.activeTasks = state.activeTasks.filter(t => t.id !== taskId);
				return state;
			});
		},

		// Clean up all event sources and active requests
		cleanup() {
			update(state => {
				// Close all EventSource connections
				state.eventSources.forEach(eventSource => {
					try {
						eventSource.close();
					} catch (err) {
						console.warn('Error closing EventSource:', err);
					}
				});
				state.eventSources.clear();
				return state;
			});
			
			// Cancel all active requests
			activeRequests.forEach(controller => {
				try {
					controller.abort();
				} catch (err) {
					console.warn('Error aborting request:', err);
				}
			});
			activeRequests.clear();
		},

		// Get task status
		async getTaskStatus(taskId: string) {
			try {
				const data = await apiRequest(`/api/scrape?task_id=${taskId}`);
				// Handle the standardized API response format
				return data.data || data; // Support both old and new formats
			} catch (error) {
				console.error('Get task status error:', error);
				throw error;
			}
		}
	};
}

export const api = createApiStore();

// Browser cleanup - ensure cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
	const handleBeforeUnload = () => {
		api.cleanup();
	};
	
	window.addEventListener('beforeunload', handleBeforeUnload);
	window.addEventListener('pagehide', handleBeforeUnload);
}

// Derived stores for easier access
export const activeTasks = derived(api, $api => $api.activeTasks);
export const isConnected = derived(api, $api => $api.connected);
export const completedTasks = derived(api, $api => 
	$api.activeTasks.filter(t => t.status === 'completed')
);
export const errorTasks = derived(api, $api => 
	$api.activeTasks.filter(t => t.status === 'error')
);
export const inProgressTasks = derived(api, $api => 
	$api.activeTasks.filter(t => t.status === 'in_progress')
);