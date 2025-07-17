import type { RequestHandler } from './$types';
import { taskEvents } from '$lib/server/taskEvents';

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
			let closed = false;

			// Helper to safely enqueue data
			const safeEnqueue = (data: string) => {
				if (!closed) {
					try {
						controller.enqueue(new TextEncoder().encode(data));
					} catch (error) {
						console.error('Failed to enqueue SSE data:', error);
						closed = true;
					}
				}
			};

			// Send initial connection event
			const initialData = `data: ${JSON.stringify({ 
				type: 'connected', 
				taskId, 
				timestamp: new Date().toISOString() 
			})}\n\n`;
			safeEnqueue(initialData);

			// Set up task update listener
			const updateListener = (data: any) => {
				const eventData = `data: ${JSON.stringify({ 
					type: 'task_update', 
					taskId, 
					...data,
					timestamp: new Date().toISOString()
				})}\n\n`;
				safeEnqueue(eventData);
			};

			taskEvents.subscribe(taskId, updateListener);

			// Set up heartbeat to keep connection alive
			const heartbeat = setInterval(() => {
				if (!closed) {
					const heartbeatData = `data: ${JSON.stringify({ 
						type: 'heartbeat', 
						timestamp: new Date().toISOString() 
					})}\n\n`;
					safeEnqueue(heartbeatData);
				}
			}, 30000); // Send heartbeat every 30 seconds

			// Clean up on close
			const cleanup = () => {
				closed = true;
				clearInterval(heartbeat);
				taskEvents.unsubscribe(taskId, updateListener);
				try {
					controller.close();
				} catch (error) {
					// Controller might already be closed
				}
			};

			request.signal.addEventListener('abort', cleanup);
		}
	});

	return new Response(stream, { headers });
};