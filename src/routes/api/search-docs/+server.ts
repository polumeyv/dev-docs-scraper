import { json } from '@sveltejs/kit';
import { IntelligentDocFinder } from '$lib/server/intelligentDocFinder';
import { validateConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate configuration
		validateConfig();

		const framework = url.searchParams.get('q')?.trim();
		
		if (!framework) {
			return json({ error: 'Please provide a framework name' }, { status: 400 });
		}

		const docFinder = new IntelligentDocFinder();
		const result = await docFinder.findOfficialDocumentation(framework);

		return json(result);

	} catch (error) {
		console.error('Error in search-docs:', error);
		
		return json(
			{ 
				error: 'Failed to find documentation',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
};