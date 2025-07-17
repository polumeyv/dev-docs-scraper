import { json } from '@sveltejs/kit';
import { ScraperService } from '$lib/server/scraperService';
import { IntelligentScraperService } from '$lib/server/intelligentScraperService';
import { 
	validateConfig, 
	createErrorResponse, 
	createSuccessResponse,
	validateRequired,
	validateString,
	validateUrl,
	collectValidationErrors
} from '$lib/server/config';
import { v4 as uuidv4 } from 'uuid';
import { taskEvents, activeTasks, cleanupTask } from '$lib/server/taskEvents';
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
		const topicName = data.topic_name?.trim();
		const mode = data.mode || 'intelligent';

		// Validate request parameters
		const validation = collectValidationErrors(
			validateRequired(url, 'url'),
			validateString(url, 'url'),
			url ? validateUrl(url, 'url') : null,
			validateRequired(framework, 'framework'),
			validateString(framework, 'framework'),
			validateString(topicName, 'topic_name'),
			validateString(mode, 'mode')
		);

		if (!validation.isValid) {
			const errorDetails = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
			return createErrorResponse(
				'Request validation failed',
				errorDetails,
				400
			);
		}

		// Validate mode parameter
		if (mode && !['intelligent', 'basic'].includes(mode)) {
			return createErrorResponse(
				'Invalid mode parameter',
				'Mode must be either "intelligent" or "basic"',
				400
			);
		}

		// Create task
		const taskId = uuidv4();
		const task = {
			id: taskId,
			url,
			framework,
			topic_name: topicName || framework,
			mode,
			status: 'queued',
			progress: 0,
			message: 'Starting...',
			createdAt: new Date().toISOString()
		};

		activeTasks.set(taskId, task);

		// Start scraping in background (don't await)
		if (mode === 'intelligent') {
			runIntelligentScraping(taskId, url, topicName || framework, framework);
		} else {
			runBasicScraping(taskId, url, framework);
		}

		return createSuccessResponse(
			{
				task_id: taskId,
				task
			},
			'Scraping started successfully'
		);

	} catch (error) {
		console.error('Error starting scrape:', error);
		
		// Handle configuration errors specifically
		if (error instanceof Error && error.message.includes('PRIVATE_GEMINI_API_KEY')) {
			return createErrorResponse(
				'Configuration error',
				'API service not properly configured. Please check server configuration.',
				503
			);
		}
		
		return createErrorResponse(
			'Failed to start scraping',
			error instanceof Error ? error.message : 'An unexpected error occurred',
			500
		);
	}
};

async function runBasicScraping(taskId: string, url: string, framework: string) {
	const progressCallback = async (id: string, updates: any) => {
		const task = activeTasks.get(id);
		if (task) {
			Object.assign(task, updates);
			activeTasks.set(id, task);
			// Emit SSE event
			taskEvents.emit(id, updates);
			
			// Clean up completed or errored tasks
			if (updates.status === 'completed' || updates.status === 'error') {
				cleanupTask(id);
			}
		}
	};

	try {
		const scraper = new ScraperService();
		await scraper.scrapeDocumentation(taskId, url, framework, progressCallback);
	} catch (error) {
		await progressCallback(taskId, {
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

async function runIntelligentScraping(
	taskId: string, 
	url: string, 
	topicName: string, 
	framework: string
) {
	const progressCallback = async (id: string, updates: any) => {
		const task = activeTasks.get(id);
		if (task) {
			Object.assign(task, updates);
			activeTasks.set(id, task);
			// Emit SSE event
			taskEvents.emit(id, updates);
			
			// Clean up completed or errored tasks
			if (updates.status === 'completed' || updates.status === 'error') {
				cleanupTask(id);
			}
		}
	};

	try {
		const scraper = new IntelligentScraperService();
		await scraper.scrapeTopic(taskId, url, topicName, framework, progressCallback);
	} catch (error) {
		await progressCallback(taskId, {
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

// GET endpoint to check task status
export const GET: RequestHandler = async ({ url }) => {
	try {
		const taskId = url.searchParams.get('task_id');
		
		// Validate required parameter
		const validation = collectValidationErrors(
			validateRequired(taskId, 'task_id'),
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

		const task = activeTasks.get(taskId!);
		
		if (!task) {
			return createErrorResponse(
				'Task not found',
				`No active task found with ID: ${taskId}`,
				404
			);
		}

		return createSuccessResponse(task, 'Task status retrieved successfully');

	} catch (error) {
		console.error('Error retrieving task status:', error);
		
		return createErrorResponse(
			'Failed to retrieve task status',
			error instanceof Error ? error.message : 'An unexpected error occurred',
			500
		);
	}
};