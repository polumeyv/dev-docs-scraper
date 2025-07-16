import type { RequestHandler } from './$types';

// Simple in-memory event system for task updates
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

const taskEvents = new TaskEventEmitter();

export const GET: RequestHandler = async ({ url, request }) => {
	const taskId = url.searchParams.get('task_id');
	
	if (!taskId) {
		return new Response('task_id parameter required', { status: 400 });
	}

	// Set up SSE headers
	const headers = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Cache-Control'
	};

	// Create a readable stream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection event
			const initialData = `data: ${JSON.stringify({ 
				type: 'connected', 
				taskId, 
				timestamp: new Date().toISOString() 
			})}\n\n`;
			controller.enqueue(new TextEncoder().encode(initialData));

			// Set up task update listener
			const updateListener = (data: any) => {
				const eventData = `data: ${JSON.stringify({ 
					type: 'task_update', 
					taskId, 
					...data,
					timestamp: new Date().toISOString()
				})}\n\n`;
				controller.enqueue(new TextEncoder().encode(eventData));
			};

			taskEvents.subscribe(taskId, updateListener);

			// Set up heartbeat to keep connection alive
			const heartbeat = setInterval(() => {
				const heartbeatData = `data: ${JSON.stringify({ 
					type: 'heartbeat', 
					timestamp: new Date().toISOString() 
				})}\n\n`;
				controller.enqueue(new TextEncoder().encode(heartbeatData));
			}, 30000); // Send heartbeat every 30 seconds

			// Clean up on close
			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeat);
				taskEvents.unsubscribe(taskId, updateListener);
				controller.close();
			});
		}
	});

	return new Response(stream, { headers });
};

// Export for use by other modules
export { taskEvents };