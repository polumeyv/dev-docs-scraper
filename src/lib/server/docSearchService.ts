import * as cheerio from 'cheerio';
import { config } from './config';

interface SearchStrategy {
	name: string;
	search: (framework: string) => Promise<SearchResult>;
	priority: number; // Higher number = higher priority
	timeout?: number;
}

interface SearchResult {
	url?: string;
	name?: string;
	confidence?: number;
	error?: string;
	source?: string;
	responseTime?: number;
}

export class DocSearchService {
	private strategies: SearchStrategy[] = [
		{
			name: 'Official Sites',
			search: async (framework: string) => await this.searchOfficialSites(framework),
			priority: 3, // Highest priority - most reliable
			timeout: 5000
		},
		{
			name: 'DevDocs',
			search: async (framework: string) => await this.searchDevDocs(framework),
			priority: 2,
			timeout: 8000
		},
		{
			name: 'ReadTheDocs',
			search: async (framework: string) => await this.searchReadTheDocs(framework),
			priority: 1,
			timeout: 10000
		}
	];

	private async sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async fetchWithRetry(url: string, options: RequestInit & { timeout?: number } = {}, maxRetries = 2): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries + 1; attempt++) {
			try {
				if (attempt > 0) {
					const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s delay
					console.log(`⏳ Retrying fetch ${url} in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
					await this.sleep(delay);
				}

				const controller = new AbortController();
				const timeout = options.timeout || config.requestTimeout;
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const { timeout: _, ...fetchOptions } = options; // Remove timeout from options
				const response = await fetch(url, {
					...fetchOptions,
					signal: controller.signal
				});

				clearTimeout(timeoutId);
				return response;

			} catch (error: any) {
				lastError = error;
				console.warn(`⚠️ Fetch attempt ${attempt + 1} failed for ${url}:`, error.message);

				// Don't retry on certain errors
				if (error.name === 'AbortError' && attempt === 0) {
					// Only retry timeouts after first attempt
					continue;
				}
				if (error.message?.includes('DNS') || error.message?.includes('ENOTFOUND')) {
					console.warn('🌐 DNS resolution failed - not retrying');
					break;
				}
			}
		}

		throw new Error(`Fetch failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
	}

	async searchDocumentation(framework: string): Promise<SearchResult[]> {
		console.log(`🔍 Searching documentation for: ${framework}`);
		
		// Sort strategies by priority (highest first)
		const sortedStrategies = [...this.strategies].sort((a, b) => b.priority - a.priority);
		
		const results = await Promise.allSettled(
			sortedStrategies.map(async (strategy) => {
				const startTime = Date.now();
				try {
					const result = await strategy.search(framework);
					const responseTime = Date.now() - startTime;
					
					if (result.url) {
						console.log(`✅ ${strategy.name} found result in ${responseTime}ms: ${result.url}`);
						return {
							...result,
							source: strategy.name,
							responseTime,
							priority: strategy.priority
						};
					} else {
						console.log(`⚠️ ${strategy.name} completed in ${responseTime}ms but found no results`);
						return {
							...result,
							source: strategy.name,
							responseTime
						};
					}
				} catch (error: any) {
					const responseTime = Date.now() - startTime;
					console.warn(`❌ ${strategy.name} failed after ${responseTime}ms:`, error.message);
					return {
						error: `${strategy.name} search failed: ${error.message}`,
						source: strategy.name,
						responseTime
					};
				}
			})
		);

		// Extract results and handle both fulfilled and rejected promises
		const searchResults = results.map(result => {
			if (result.status === 'fulfilled') {
				return result.value;
			} else {
				return {
					error: `Strategy failed: ${result.reason.message}`,
					source: 'unknown'
				};
			}
		});

		// Sort results: successful results first (by priority), then errors
		const sortedResults = searchResults.sort((a, b) => {
			const aHasUrl = 'url' in a && !!a.url;
			const bHasUrl = 'url' in b && !!b.url;
			
			// Successful results first
			if (aHasUrl && !bHasUrl) return -1;
			if (!aHasUrl && bHasUrl) return 1;
			
			// Both successful: sort by priority
			if (aHasUrl && bHasUrl) {
				const aPriority = 'priority' in a ? Number(a.priority || 0) : 0;
				const bPriority = 'priority' in b ? Number(b.priority || 0) : 0;
				return bPriority - aPriority;
			}
			
			// Both failures: maintain order
			return 0;
		});

		console.log(`📊 Search completed: ${sortedResults.filter(r => 'url' in r && !!r.url).length} successful, ${sortedResults.filter(r => 'error' in r && !!r.error).length} failed`);
		
		return sortedResults;
	}

	private async searchDevDocs(framework: string): Promise<SearchResult> {
		const searchUrl = `https://devdocs.io/${framework.toLowerCase()}/`;
		
		try {
			const response = await this.fetchWithRetry(searchUrl, { 
				method: 'HEAD',
				timeout: 8000
			});
			
			if (response.ok) {
				return {
					url: searchUrl,
					name: `${framework} - DevDocs`,
					confidence: 0.9
				};
			} else if (response.status === 404) {
				return { error: 'Framework not found on DevDocs' };
			} else {
				return { error: `DevDocs returned status ${response.status}` };
			}
		} catch (error: any) {
			if (error.message?.includes('timeout') || error.message?.includes('AbortError')) {
				return { error: 'DevDocs request timed out' };
			}
			return { error: `DevDocs search error: ${error.message}` };
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
		const searchUrl = `https://${framework.toLowerCase()}.readthedocs.io/`;
		
		try {
			const response = await this.fetchWithRetry(searchUrl, { 
				method: 'HEAD',
				timeout: 10000
			});
			
			if (response.ok) {
				return {
					url: searchUrl,
					name: `${framework} - Read the Docs`,
					confidence: 0.8
				};
			} else if (response.status === 404) {
				return { error: 'Framework not found on ReadTheDocs' };
			} else {
				return { error: `ReadTheDocs returned status ${response.status}` };
			}
		} catch (error: any) {
			if (error.message?.includes('timeout') || error.message?.includes('AbortError')) {
				return { error: 'ReadTheDocs request timed out' };
			}
			return { error: `ReadTheDocs search error: ${error.message}` };
		}
	}

	async searchWeb(query: string): Promise<SearchResult> {
		// In a production environment, you'd use a search API like Google Custom Search
		// For now, we'll return a placeholder
		return {
			error: 'Web search not implemented. Consider using Google Custom Search API.'
		};
	}

	// Service health check method
	async checkServiceHealth(): Promise<{ [key: string]: any }> {
		const healthChecks = await Promise.allSettled(
			this.strategies.map(async (strategy) => {
				const startTime = Date.now();
				try {
					// Test each strategy with a known framework
					const result = await strategy.search('react');
					const responseTime = Date.now() - startTime;
					
					return {
						strategy: strategy.name,
						status: 'healthy',
						responseTime,
						hasResult: !!result.url
					};
				} catch (error: any) {
					const responseTime = Date.now() - startTime;
					return {
						strategy: strategy.name,
						status: 'unhealthy',
						responseTime,
						error: error.message
					};
				}
			})
		);

		const results = healthChecks.map(check => {
			if (check.status === 'fulfilled') {
				return check.value;
			} else {
				return {
					strategy: 'unknown',
					status: 'failed',
					error: check.reason.message
				};
			}
		});

		const healthyCount = results.filter(r => r.status === 'healthy').length;
		const totalCount = results.length;

		return {
			overall: healthyCount > 0 ? 'healthy' : 'unhealthy',
			healthyStrategies: healthyCount,
			totalStrategies: totalCount,
			strategies: results,
			timestamp: new Date().toISOString()
		};
	}
}