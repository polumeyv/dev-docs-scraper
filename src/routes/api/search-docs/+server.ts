import { json } from '@sveltejs/kit';
import { IntelligentDocFinder } from '$lib/server/intelligentDocFinder';
import { validateConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const framework = url.searchParams.get('q')?.trim();
	
	if (!framework) {
		return json({ 
			framework: '',
			links: [],
			error: 'Please provide a framework name' 
		}, { status: 400 });
	}

	try {
		// Validate configuration
		validateConfig();

		const docFinder = new IntelligentDocFinder();
		const result = await docFinder.findOfficialDocumentation(framework);

		// Transform the result to match the expected format
		if (result.error) {
			return json({
				framework,
				links: [],
				error: result.error,
				suggestions: result.suggestions || []
			});
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

		return json({
			framework,
			links,
			confidence: result.confidence
		});

	} catch (error) {
		console.error('Error in search-docs:', error);
		
		return json(
			{ 
				framework: framework || 'unknown',
				links: [],
				error: 'Failed to find documentation',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
};