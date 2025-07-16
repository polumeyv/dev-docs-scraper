import { writable, derived } from 'svelte/store';
import { api, type DownloadTask as ApiTask } from './api';

// Re-export from API store for backward compatibility
export type DownloadTask = ApiTask;

interface WebSocketState {
	connected: boolean;
	activeDownloads: DownloadTask[];
	queuedDownloads: DownloadTask[];
}

function createWebSocketStore() {
	// Use the new API store instead of WebSocket
	const { subscribe } = derived(api, $api => ({
		connected: $api.connected,
		activeDownloads: $api.activeTasks.filter(task => task.status !== 'queued'),
		queuedDownloads: $api.activeTasks.filter(task => task.status === 'queued')
	}));
	
	return {
		subscribe,
		connect: () => {
			// No-op for SvelteKit - always connected
			console.log('Connected to SvelteKit API');
		},
		disconnect: () => {
			api.cleanup();
		},
		subscribeToTask: (taskId: string) => {
			api.subscribeToTask(taskId);
		},
		cancelDownload: async (taskId: string) => {
			// Remove task (no cancel endpoint implemented yet)
			api.removeTask(taskId);
			return true;
		}
	};
}

export const websocket = createWebSocketStore();

// Derived stores for easier access
export const isConnected = derived(
	websocket,
	$websocket => $websocket.connected
);

export const activeDownloads = derived(
	websocket,
	$websocket => $websocket.activeDownloads
);

export const queuedDownloads = derived(
	websocket,
	$websocket => $websocket.queuedDownloads
);

export const totalDownloads = derived(
	websocket,
	$websocket => $websocket.activeDownloads.length + $websocket.queuedDownloads.length
);