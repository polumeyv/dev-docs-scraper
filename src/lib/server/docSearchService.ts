import * as cheerio from 'cheerio';

interface SearchStrategy {
	name: string;
	search: (framework: string) => Promise<SearchResult>;
}

interface SearchResult {
	url?: string;
	name?: string;
	confidence?: number;
	error?: string;
}

export class DocSearchService {
	private strategies: SearchStrategy[] = [
		{
			name: 'DevDocs',
			search: async (framework: string) => await this.searchDevDocs(framework)
		},
		{
			name: 'Official Sites',
			search: async (framework: string) => await this.searchOfficialSites(framework)
		},
		{
			name: 'ReadTheDocs',
			search: async (framework: string) => await this.searchReadTheDocs(framework)
		}
	];

	async searchDocumentation(framework: string): Promise<SearchResult[]> {
		const results = await Promise.all(
			this.strategies.map(strategy => 
				strategy.search(framework).catch(error => ({
					error: `${strategy.name} search failed: ${error.message}`
				}))
			)
		);
		
		return results.filter(result => 'url' in result || 'error' in result);
	}

	private async searchDevDocs(framework: string): Promise<SearchResult> {
		try {
			const searchUrl = `https://devdocs.io/${framework.toLowerCase()}/`;
			const response = await fetch(searchUrl, { method: 'HEAD' });
			
			if (response.ok) {
				return {
					url: searchUrl,
					name: `${framework} - DevDocs`,
					confidence: 0.9
				};
			}
			
			return { error: 'Not found on DevDocs' };
		} catch (error) {
			return { error: `DevDocs search error: ${error}` };
		}
	}

	private async searchOfficialSites(framework: string): Promise<SearchResult> {
		const officialDocs: Record<string, string> = {
			'react': 'https://react.dev/',
			'vue': 'https://vuejs.org/',
			'angular': 'https://angular.io/docs',
			'svelte': 'https://svelte.dev/docs',
			'nextjs': 'https://nextjs.org/docs',
			'express': 'https://expressjs.com/',
			'django': 'https://docs.djangoproject.com/',
			'flask': 'https://flask.palletsprojects.com/',
			'fastapi': 'https://fastapi.tiangolo.com/',
			'nodejs': 'https://nodejs.org/docs/',
			'typescript': 'https://www.typescriptlang.org/docs/',
			'tailwind': 'https://tailwindcss.com/docs',
			'bootstrap': 'https://getbootstrap.com/docs/'
		};

		const normalizedFramework = framework.toLowerCase().replace(/[^a-z]/g, '');
		const docUrl = officialDocs[normalizedFramework];
		
		if (docUrl) {
			return {
				url: docUrl,
				name: `${framework} Official Documentation`,
				confidence: 1.0
			};
		}
		
		return { error: 'No official documentation found' };
	}

	private async searchReadTheDocs(framework: string): Promise<SearchResult> {
		try {
			const searchUrl = `https://${framework.toLowerCase()}.readthedocs.io/`;
			const response = await fetch(searchUrl, { method: 'HEAD' });
			
			if (response.ok) {
				return {
					url: searchUrl,
					name: `${framework} - Read the Docs`,
					confidence: 0.8
				};
			}
			
			return { error: 'Not found on ReadTheDocs' };
		} catch (error) {
			return { error: `ReadTheDocs search error: ${error}` };
		}
	}

	async searchWeb(query: string): Promise<SearchResult> {
		// In a production environment, you'd use a search API like Google Custom Search
		// For now, we'll return a placeholder
		return {
			error: 'Web search not implemented. Consider using Google Custom Search API.'
		};
	}
}