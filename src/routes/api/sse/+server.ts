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