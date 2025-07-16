export interface ProgressUpdate {
	taskId: string;
	status: 'queued' | 'in_progress' | 'completed' | 'error';
	progress: number;
	message: string;
	totalPages?: number;
	pagesScraped?: number;
	error?: string;
	[key: string]: any;
}

export type ProgressCallback = (taskId: string, update: ProgressUpdate) => Promise<void>;

export class ProgressTracker {
	private callbacks: Map<string, ProgressCallback> = new Map();
	
	registerCallback(taskId: string, callback: ProgressCallback) {
		this.callbacks.set(taskId, callback);
	}
	
	unregisterCallback(taskId: string) {
		this.callbacks.delete(taskId);
	}
	
	async updateProgress(taskId: string, update: Partial<ProgressUpdate>) {
		const callback = this.callbacks.get(taskId);
		if (callback) {
			const fullUpdate: ProgressUpdate = {
				taskId,
				status: 'in_progress',
				progress: 0,
				message: '',
				...update
			};
			await callback(taskId, fullUpdate);
		}
	}
	
	async reportError(taskId: string, error: string) {
		await this.updateProgress(taskId, {
			status: 'error',
			error,
			message: `Error: ${error}`
		});
	}
	
	async reportComplete(taskId: string, message: string = 'Task completed') {
		await this.updateProgress(taskId, {
			status: 'completed',
			progress: 100,
			message
		});
	}
}

export const progressTracker = new ProgressTracker();