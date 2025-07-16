import { json } from '@sveltejs/kit';
import { TopicDiscoveryService } from '$lib/server/topicDiscoveryService';
import { validateConfig } from '$lib/server/config';
import { progressTracker } from '$lib/server/progressTracker';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Validate configuration
		validateConfig();

		const data = await request.json();
		const url = data.url?.trim();
		const framework = data.framework?.trim();
		const taskId = data.task_id;

		if (!url || !framework) {
			return json({ error: 'URL and framework are required' }, { status: 400 });
		}

		// Create progress callback for SSE updates if task_id provided
		let progressCallback;
		if (taskId) {
			progressCallback = async (id: string, update: any) => {
				// This will be handled by the SSE endpoint
				// For now, we'll emit to a global event emitter
				// that the SSE endpoint can listen to
				console.log(`Task ${id} update:`, update);
			};
		}

		const discoveryService = new TopicDiscoveryService();
		const result = await discoveryService.discoverTopics(
			url, 
			framework, 
			taskId, 
			progressCallback
		);

		return json(result);

	} catch (error) {
		console.error('Error discovering topics:', error);
		
		return json(
			{ 
				error: 'Failed to discover topics',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
};