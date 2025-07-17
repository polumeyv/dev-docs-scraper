import type { RequestHandler } from './$types';
import { taskEvents } from '$lib/server/taskEvents';

// Track active SSE connections for monitoring
const activeConnections = new Map<string, { count: number; lastActivity: Date }>();

// Connection timeout (5 minutes of inactivity)
const CONNECTION_TIMEOUT = 5 * 60 * 1000;

export const GET: RequestHandler = async ({ url, request }) => {
	const taskId = url.searchParams.get('task_id');
	
	if (!taskId) {
		console.warn('SSE connection attempted without task_id');
		return new Response('task_id parameter required', { status: 400 });
	}

	console.log(`SSE connection requested for task: ${taskId}`);
	
	// Track connection
	const connectionInfo = activeConnections.get(taskId) || { count: 0, lastActivity: new Date() };
	connectionInfo.count++;
	connectionInfo.lastActivity = new Date();
	activeConnections.set(taskId, connectionInfo);
	
	console.log(`Active SSE connections for task ${taskId}: ${connectionInfo.count}`);

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
			let lastActivity = Date.now();

			// Helper to safely enqueue data
			const safeEnqueue = (data: string) => {
				if (!closed) {
					try {
						controller.enqueue(new TextEncoder().encode(data));
						lastActivity = Date.now();
						
						// Update connection activity
						const connInfo = activeConnections.get(taskId);
						if (connInfo) {
							connInfo.lastActivity = new Date();
						}
					} catch (error) {
						console.error(`Failed to enqueue SSE data for task ${taskId}:`, error);
						closed = true;
						
						// Emit error event to task
						try {
							taskEvents.emit(taskId, {
								type: 'error',
								message: 'SSE connection error',
								error: error instanceof Error ? error.message : 'Unknown error'
							});
						} catch (emitError) {
							console.error(`Failed to emit error event for task ${taskId}:`, emitError);
						}
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

			// Set up heartbeat to keep connection alive and check for timeouts
			const heartbeat = setInterval(() => {
				if (!closed) {
					// Check for connection timeout
					const timeSinceLastActivity = Date.now() - lastActivity;
					if (timeSinceLastActivity > CONNECTION_TIMEOUT) {
						console.log(`SSE connection timeout for task ${taskId} (inactive for ${Math.round(timeSinceLastActivity / 1000)}s)`);
						cleanup();
						return;
					}
					
					const heartbeatData = `data: ${JSON.stringify({ 
						type: 'heartbeat', 
						timestamp: new Date().toISOString(),
						activeConnections: activeConnections.get(taskId)?.count || 0
					})}\n\n`;
					safeEnqueue(heartbeatData);
				} else {
					clearInterval(heartbeat);
				}
			}, 30000); // Send heartbeat every 30 seconds

			// Clean up on close
			const cleanup = () => {
				if (closed) return; // Prevent double cleanup
				
				console.log(`Cleaning up SSE connection for task: ${taskId}`);
				closed = true;
				clearInterval(heartbeat);
				taskEvents.unsubscribe(taskId, updateListener);
				
				// Update connection tracking
				const connInfo = activeConnections.get(taskId);
				if (connInfo) {
					connInfo.count = Math.max(0, connInfo.count - 1);
					if (connInfo.count === 0) {
						activeConnections.delete(taskId);
						console.log(`All SSE connections closed for task: ${taskId}`);
					} else {
						console.log(`SSE connections remaining for task ${taskId}: ${connInfo.count}`);
					}
				}
				
				try {
					controller.close();
				} catch (error) {
					console.warn(`Error closing SSE controller for task ${taskId}:`, error);
				}
			};

			request.signal.addEventListener('abort', cleanup);
		}
	});

	return new Response(stream, { headers });
};