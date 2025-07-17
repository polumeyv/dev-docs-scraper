// Shared event emitter for task updates
class TaskEventEmitter {
	private listeners = new Map<string, Set<(data: any) => void>>();

	subscribe(taskId: string, callback: (data: any) => void) {
		if (!this.listeners.has(taskId)) {
			this.listeners.set(taskId, new Set());
		}
		this.listeners.get(taskId)!.add(callback);
	}

	unsubscribe(taskId: string, callback: (data: any) => void) {
		const listeners = this.listeners.get(taskId);
		if (listeners) {
			listeners.delete(callback);
			if (listeners.size === 0) {
				this.listeners.delete(taskId);
			}
		}
	}

	emit(taskId: string, data: any) {
		const listeners = this.listeners.get(taskId);
		if (listeners) {
			listeners.forEach(callback => callback(data));
		}
	}
}

export const taskEvents = new TaskEventEmitter();

// Store active tasks (in production, use Redis or database)
export const activeTasks = new Map<string, any>();

// Clean up completed tasks after 5 minutes
export function cleanupTask(taskId: string, delay = 300000) {
	setTimeout(() => {
		activeTasks.delete(taskId);
		// Clean up any remaining listeners
		taskEvents.emit(taskId, { type: 'cleanup', status: 'removed' });
	}, delay);
}