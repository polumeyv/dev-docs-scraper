import { json } from '@sveltejs/kit';
import { TopicDiscoveryService } from '$lib/server/topicDiscoveryService';
import { 
	validateConfig,
	createErrorResponse,
	createSuccessResponse,
	validateRequired,
	validateString,
	validateUrl,
	collectValidationErrors
} from '$lib/server/config';
import { progressTracker } from '$lib/server/progressTracker';
import { taskEvents } from '$lib/server/taskEvents';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Validate configuration first
		validateConfig();

		// Parse and validate request body
		let data;
		try {
			data = await request.json();
		} catch (parseError) {
			return createErrorResponse(
				'Invalid JSON in request body',
				parseError instanceof Error ? parseError.message : 'Request body must be valid JSON',
				400
			);
		}

		const url = data.url?.trim();
		const framework = data.framework?.trim();
		const taskId = data.task_id;

		// Validate request parameters
		const validation = collectValidationErrors(
			validateRequired(url, 'url'),
			validateString(url, 'url'),
			url ? validateUrl(url, 'url') : null,
			validateRequired(framework, 'framework'),
			validateString(framework, 'framework'),
			validateString(taskId, 'task_id')
		);

		if (!validation.isValid) {
			const errorDetails = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
			return createErrorResponse(
				'Request validation failed',
				errorDetails,
				400
			);
		}

		// Create progress callback for SSE updates if task_id provided
		let progressCallback;
		if (taskId) {
			progressCallback = async (id: string, update: any) => {
				// Emit progress updates via SSE to connected clients
				taskEvents.emit(id, {
					type: 'task_update',
					...update,
					timestamp: new Date().toISOString()
				});
			};
		}

		const discoveryService = new TopicDiscoveryService();
		const result = await discoveryService.discoverTopics(
			url, 
			framework, 
			taskId, 
			progressCallback
		);

		// Validate that the service returned a result
		if (!result) {
			return createErrorResponse(
				'Topic discovery failed',
				'No topics could be discovered from the provided URL',
				500
			);
		}

		return createSuccessResponse(result, 'Topics discovered successfully');

	} catch (error) {
		console.error('Error discovering topics:', error);
		
		// Handle configuration errors specifically
		if (error instanceof Error && error.message.includes('PRIVATE_GEMINI_API_KEY')) {
			return createErrorResponse(
				'Configuration error',
				'API service not properly configured. Please check server configuration.',
				503
			);
		}

		// Handle timeout errors
		if (error instanceof Error && error.message.includes('timeout')) {
			return createErrorResponse(
				'Request timeout',
				'Topic discovery timed out. The website might be slow to respond or temporarily unavailable.',
				408
			);
		}
		
		return createErrorResponse(
			'Failed to discover topics',
			error instanceof Error ? error.message : 'An unexpected error occurred while discovering topics',
			500
		);
	}
};