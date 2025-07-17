import { json } from '@sveltejs/kit';
import { ScraperService } from '$lib/server/scraperService';
import { IntelligentScraperService } from '$lib/server/intelligentScraperService';
import { validateConfig } from '$lib/server/config';
import { v4 as uuidv4 } from 'uuid';
import { taskEvents, activeTasks, cleanupTask } from '$lib/server/taskEvents';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Validate configuration
		validateConfig();

		const data = await request.json();
		const url = data.url?.trim();
		const framework = data.framework?.trim();
		const topicName = data.topic_name?.trim();
		const mode = data.mode || 'intelligent'; // 'intelligent' or 'basic'

		if (!url || !framework) {
			return json({ error: 'URL and framework are required' }, { status: 400 });
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

		return json({
			task_id: taskId,
			message: 'Scraping started'
		});

	} catch (error) {
		console.error('Error starting scrape:', error);
		
		return json(
			{ 
				error: 'Failed to start scraping',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
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
	const taskId = url.searchParams.get('task_id');
	
	if (!taskId) {
		return json({ error: 'task_id parameter required' }, { status: 400 });
	}

	const task = activeTasks.get(taskId);
	
	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	return json(task);
};