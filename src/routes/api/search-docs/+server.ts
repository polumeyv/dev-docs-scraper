import { json } from '@sveltejs/kit';
import { IntelligentDocFinder } from '$lib/server/intelligentDocFinder';
import { 
	validateConfig,
	createErrorResponse,
	createSuccessResponse,
	validateRequired,
	validateString,
	collectValidationErrors
} from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const framework = url.searchParams.get('q')?.trim();
		
		// Validate required parameter
		const validation = collectValidationErrors(
			validateRequired(framework, 'q (framework)'),
			validateString(framework, 'q (framework)')
		);

		if (!validation.isValid) {
			const errorDetails = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
			return createErrorResponse(
				'Request validation failed',
				errorDetails,
				400
			);
		}

		// Validate configuration
		validateConfig();

		const docFinder = new IntelligentDocFinder();
		const result = await docFinder.findOfficialDocumentation(framework!);

		// Handle service-level errors
		if (!result) {
			return createErrorResponse(
				'Documentation search failed',
				'Unable to process documentation search request',
				500
			);
		}

		// Transform the result to match the expected format
		if (result.error) {
			return createErrorResponse(
				'Documentation not found',
				result.error,
				404
			);
		}

		// Create links array from the result
		const links = [];
		
		if (result.official_docs) {
			links.push({
				title: `${result.corrected_name || framework} Documentation`,
				url: result.official_docs,
				type: 'official' as const,
				description: `Official documentation for ${result.corrected_name || framework}`
			});
		}

		if (result.alternatives && Array.isArray(result.alternatives)) {
			result.alternatives.forEach((url: string, index: number) => {
				links.push({
					title: `Alternative Documentation ${index + 1}`,
					url,
					type: 'reference' as const,
					description: 'Alternative documentation resource'
				});
			});
		}

		return createSuccessResponse({
			framework: result.corrected_name || framework,
			links,
			confidence: result.confidence,
			suggestions: result.suggestions || []
		}, 'Documentation search completed successfully');

	} catch (error) {
		console.error('Error in search-docs:', error);
		
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
				'Documentation search timed out. Please try again with a different framework name.',
				408
			);
		}
		
		return createErrorResponse(
			'Failed to find documentation',
			error instanceof Error ? error.message : 'An unexpected error occurred during documentation search',
			500
		);
	}
};