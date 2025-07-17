import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { IntelligentDocFinder } from '$lib/server/intelligentDocFinder';
import { DocSearchService } from '$lib/server/docSearchService';
import { getEnvironmentConfig } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const startTime = Date.now();
	
	try {
		// Initialize services
		const intelligentDocFinder = new IntelligentDocFinder();
		const docSearchService = new DocSearchService();
		
		// Get environment configuration
		const envConfig = getEnvironmentConfig();
		
		// Perform health checks in parallel
		const [geminiStatus, docSearchStatus] = await Promise.allSettled([
			// Check Gemini API / IntelligentDocFinder status
			Promise.resolve(intelligentDocFinder.getServiceStatus()),
			
			// Check DocSearchService status
			docSearchService.checkServiceHealth()
		]);

		// Process Gemini API status
		const geminiHealth = geminiStatus.status === 'fulfilled' 
			? geminiStatus.value 
			: { 
				isHealthy: false, 
				error: geminiStatus.reason?.message || 'Unknown error',
				failures: 999
			};

		// Process DocSearch status
		const docSearchHealth = docSearchStatus.status === 'fulfilled'
			? docSearchStatus.value
			: {
				overall: 'unhealthy',
				error: docSearchStatus.reason?.message || 'Unknown error',
				healthyStrategies: 0,
				totalStrategies: 0
			};

		// Calculate overall health
		const isGeminiHealthy = geminiHealth.isHealthy;
		const isDocSearchHealthy = docSearchHealth.overall === 'healthy';
		const hasPartialService = docSearchHealth.healthyStrategies > 0;
		
		let overallStatus: string;
		let statusMessage: string;
		
		if (isGeminiHealthy && isDocSearchHealthy) {
			overallStatus = 'healthy';
			statusMessage = 'All services operational';
		} else if (hasPartialService) {
			overallStatus = 'degraded';
			statusMessage = 'Some services experiencing issues - limited functionality available';
		} else {
			overallStatus = 'unhealthy';
			statusMessage = 'Multiple service failures detected';
		}

		const responseTime = Date.now() - startTime;

		return json({
			status: overallStatus,
			message: statusMessage,
			timestamp: new Date().toISOString(),
			responseTime: `${responseTime}ms`,
			service: 'docs-scraper-sveltekit',
			environment: envConfig.environment,
			version: '1.0.0',
			services: {
				geminiApi: {
					status: isGeminiHealthy ? 'healthy' : 'unhealthy',
					isHealthy: isGeminiHealthy,
					failures: geminiHealth.failures,
					circuitBreakerOpen: geminiHealth.circuitBreakerOpen,
					lastFailureTime: geminiHealth.lastFailureTime,
					config: geminiHealth.config
				},
				docSearch: {
					status: docSearchHealth.overall,
					healthyStrategies: docSearchHealth.healthyStrategies,
					totalStrategies: docSearchHealth.totalStrategies,
					strategies: docSearchHealth.strategies,
					lastChecked: docSearchHealth.timestamp
				}
			},
			capabilities: {
				intelligentSearch: isGeminiHealthy,
				basicSearch: hasPartialService,
				fallbackAvailable: hasPartialService || isDocSearchHealthy
			}
		});

	} catch (error: any) {
		const responseTime = Date.now() - startTime;
		
		console.error('Health check failed:', error);
		
		return json({
			status: 'error',
			message: 'Health check failed',
			error: error.message,
			timestamp: new Date().toISOString(),
			responseTime: `${responseTime}ms`,
			service: 'docs-scraper-sveltekit'
		}, { status: 503 });
	}
};