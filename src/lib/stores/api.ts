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

	return {
		subscribe,

		// Search for documentation
		async searchDocumentation(framework: string) {
			try {
				const response = await fetch(`/api/search-docs?q=${encodeURIComponent(framework)}`);
				return await response.json();
			} catch (error) {
				console.error('Search documentation error:', error);
				throw error;
			}
		},

		// Discover topics
		async discoverTopics(url: string, framework: string, taskId?: string) {
			try {
				const response = await fetch('/api/discover-topics', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url, framework, task_id: taskId })
				});
				return await response.json();
			} catch (error) {
				console.error('Discover topics error:', error);
				throw error;
			}
		},

		// Start scraping
		async startScraping(url: string, framework: string, topicName?: string, mode: 'intelligent' | 'basic' = 'intelligent') {
			try {
				const response = await fetch('/api/scrape', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						url, 
						framework, 
						topic_name: topicName,
						mode 
					})
				});
				
				const result = await response.json();
				
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

				const eventSource = new EventSource(`/api/sse?task_id=${taskId}`);
				
				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						
						if (data.type === 'task_update') {
							this.updateTask(taskId, data);
						}
					} catch (error) {
						console.error('Error parsing SSE message:', error);
					}
				};

				eventSource.onerror = (error) => {
					console.error('SSE error for task', taskId, error);
					// Clean up on error
					eventSource.close();
					update(state => {
						state.eventSources.delete(taskId);
						return state;
					});
				};

				state.eventSources.set(taskId, eventSource);
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

		// Clean up all event sources
		cleanup() {
			update(state => {
				state.eventSources.forEach(eventSource => eventSource.close());
				state.eventSources.clear();
				return state;
			});
		},

		// Get task status
		async getTaskStatus(taskId: string) {
			try {
				const response = await fetch(`/api/scrape?task_id=${taskId}`);
				return await response.json();
			} catch (error) {
				console.error('Get task status error:', error);
				throw error;
			}
		}
	};
}

export const api = createApiStore();

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