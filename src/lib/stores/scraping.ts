import { writable, derived, get } from 'svelte/store';
import { api, type DownloadTask } from './api';

// Re-export DownloadTask as ScrapeTask for compatibility
export type ScrapeTask = DownloadTask;

function createScrapingStore() {
	const { subscribe, set, update } = writable<ScrapeTask | null>(null);
	
	// Subscribe to the latest active task from the API store
	api.subscribe(apiState => {
		const latestTask = apiState.activeTasks[apiState.activeTasks.length - 1];
		if (latestTask) {
			set(latestTask);
		}
	});
	
	return {
		subscribe,
		
		connect() {
			// No-op for SvelteKit - always connected
			console.log('Connected to SvelteKit API');
		},
		
		disconnect() {
			api.cleanup();
		},
		
		async startScraping(url: string, framework: string, topic_name?: string, mode: string = 'intelligent') {
			try {
				const result = await api.startScraping(
					url, 
					framework, 
					topic_name,
					mode as 'intelligent' | 'basic'
				);
				
				return result.task_id;
			} catch (error) {
				console.error('Error starting scrape:', error);
				throw error;
			}
		},
		
		reset() {
			set(null);
		}
	};
}

export const scraping = createScrapingStore();