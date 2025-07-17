import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, circuitBreakerState } from './config';
import { DocSearchService } from './docSearchService';
import * as cheerio from 'cheerio';

export class IntelligentDocFinder {
	private genAI: GoogleGenerativeAI;
	private model: any;
	private docSearchService: DocSearchService;

	constructor() {
		this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
		this.docSearchService = new DocSearchService();
	}

	private async sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private calculateBackoffDelay(attempt: number): number {
		// Exponential backoff: 1s, 2s, 4s, 8s, 16s
		return Math.min(1000 * Math.pow(2, attempt), 16000);
	}

	private isCircuitBreakerOpen(): boolean {
		const now = Date.now();
		
		// Reset circuit breaker if enough time has passed
		if (circuitBreakerState.isOpen && 
			now - circuitBreakerState.lastFailureTime > config.circuitBreakerConfig.resetTimeout) {
			circuitBreakerState.isOpen = false;
			circuitBreakerState.failures = 0;
			console.log('🔄 Circuit breaker reset - attempting to reconnect to Gemini API');
		}

		return circuitBreakerState.isOpen;
	}

	private recordFailure(): void {
		circuitBreakerState.failures++;
		circuitBreakerState.lastFailureTime = Date.now();
		
		if (circuitBreakerState.failures >= config.circuitBreakerConfig.failureThreshold) {
			circuitBreakerState.isOpen = true;
			console.warn(`⚠️ Circuit breaker opened after ${circuitBreakerState.failures} failures`);
		}
	}

	private recordSuccess(): void {
		if (circuitBreakerState.failures > 0) {
			console.log('✅ Gemini API call successful - resetting failure count');
		}
		circuitBreakerState.failures = 0;
	}

	private async callGeminiWithRetry(prompt: string): Promise<string> {
		// Check circuit breaker
		if (this.isCircuitBreakerOpen()) {
			throw new Error('Circuit breaker is open - Gemini API temporarily unavailable');
		}

		let lastError: Error | null = null;

		for (let attempt = 0; attempt < config.maxRetries; attempt++) {
			try {
				// Add delay before retry (except first attempt)
				if (attempt > 0) {
					const delay = this.calculateBackoffDelay(attempt - 1);
					console.log(`⏳ Retrying Gemini API call in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);
					await this.sleep(delay);
				}

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);

				const result = await this.model.generateContent(prompt);
				clearTimeout(timeoutId);

				if (!result.response) {
					throw new Error('No response received from Gemini API');
				}

				this.recordSuccess();
				return result.response.text();

			} catch (error: any) {
				lastError = error;
				console.warn(`⚠️ Gemini API call failed (attempt ${attempt + 1}/${config.maxRetries}):`, error.message);

				// Check for specific error types
				if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
					console.warn('📊 Rate limit or quota exceeded - applying longer backoff');
					await this.sleep(this.calculateBackoffDelay(attempt) * 2); // Double the backoff for quota issues
				} else if (error.message?.includes('timeout') || error.message?.includes('network')) {
					console.warn('🌐 Network or timeout error - retrying with exponential backoff');
				}

				// Don't retry on authentication errors
				if (error.message?.includes('API key') || error.message?.includes('authentication')) {
					console.error('🔑 Authentication error - not retrying');
					this.recordFailure();
					throw error;
				}
			}
		}

		this.recordFailure();
		throw new Error(`Gemini API failed after ${config.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
	}

	async findOfficialDocumentation(framework: string): Promise<any> {
		try {
			// First, try traditional search methods
			const searchResults = await this.docSearchService.searchDocumentation(framework);
			const validResults = searchResults.filter(r => r.url);
			
			if (validResults.length > 0) {
				// Use AI to validate and rank results
				const prompt = `Given these documentation URLs for "${framework}":
${validResults.map(r => `- ${r.url} (${r.name})`).join('\n')}

Which one is most likely the official documentation? Consider:
1. Official domain names
2. Documentation structure
3. Reliability

Respond with just the URL of the best option.`;

				try {
					const bestUrl = await this.callGeminiWithRetry(prompt);
					const trimmedUrl = bestUrl.trim();
					
					const bestResult = validResults.find(r => r.url === trimmedUrl) || validResults[0];
					
					return {
						framework,
						official_docs: bestResult.url,
						confidence: bestResult.confidence || 0.8,
						alternatives: validResults.filter(r => r.url !== bestResult.url).map(r => r.url)
					};
				} catch (error) {
					console.warn('⚠️ AI ranking failed, using first valid result:', error);
					const bestResult = validResults[0];
					return {
						framework,
						official_docs: bestResult.url,
						confidence: bestResult.confidence || 0.6,
						alternatives: validResults.slice(1).map(r => r.url),
						fallback: 'AI ranking unavailable'
					};
				}
			}

			// If no results, use AI to suggest
			return await this.intelligentSearch(framework);
		} catch (error) {
			console.error('Intelligent doc finder error:', error);
			
			// Enhanced fallback strategy
			try {
				console.log('🔄 Attempting fallback to basic search without AI');
				const results = await this.docSearchService.searchDocumentation(framework);
				const validResult = results.find(r => r.url);
				
				if (validResult) {
					return {
						framework,
						official_docs: validResult.url,
						confidence: validResult.confidence || 0.4,
						fallback: 'Basic search (AI unavailable)',
						alternatives: results.filter(r => r.url && r.url !== validResult.url).map(r => r.url)
					};
				}
			} catch (fallbackError) {
				console.error('❌ Fallback search also failed:', fallbackError);
			}
			
			return {
				framework,
				error: 'Documentation search failed - all services unavailable',
				suggestions: this.getCommonFrameworkVariations(framework),
				troubleshooting: 'Check network connectivity and try again later'
			};
		}
	}

	private async intelligentSearch(framework: string): Promise<any> {
		const prompt = `What is the official documentation URL for "${framework}"? 
Consider common misspellings and variations.
If you're not sure, suggest the most likely official documentation URL.
Respond with a JSON object containing:
- url: the documentation URL
- corrected_name: the correct framework name if different
- confidence: a number between 0 and 1`;

		try {
			const responseText = await this.callGeminiWithRetry(prompt);
			
			// Extract JSON from response
			const jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const data = JSON.parse(jsonMatch[0]);
				return {
					framework,
					official_docs: data.url,
					confidence: data.confidence || 0.7,
					corrected_name: data.corrected_name,
					source: 'AI intelligent search'
				};
			} else {
				console.warn('⚠️ AI response did not contain valid JSON, falling back');
				throw new Error('Invalid AI response format');
			}
		} catch (error) {
			console.error('❌ AI intelligent search failed:', error);
			
			// Fallback to basic search as last resort
			try {
				const results = await this.docSearchService.searchDocumentation(framework);
				const validResult = results.find(r => r.url);
				
				if (validResult) {
					return {
						framework,
						official_docs: validResult.url,
						confidence: validResult.confidence || 0.3,
						fallback: 'Basic search (AI intelligent search failed)',
						alternatives: results.filter(r => r.url && r.url !== validResult.url).map(r => r.url)
					};
				}
			} catch (fallbackError) {
				console.error('❌ Fallback search in intelligent search also failed:', fallbackError);
			}
		}

		return {
			framework,
			error: 'Could not determine documentation URL - all search methods failed',
			suggestions: this.getCommonFrameworkVariations(framework),
			troubleshooting: 'Try checking the framework name spelling or try again later'
		};
	}

	private getCommonFrameworkVariations(framework: string): string[] {
		const variations: string[] = [];
		const lower = framework.toLowerCase();
		
		// Common variations
		if (lower.includes('react')) variations.push('React', 'ReactJS', 'React.js');
		if (lower.includes('vue')) variations.push('Vue', 'VueJS', 'Vue.js');
		if (lower.includes('angular')) variations.push('Angular', 'AngularJS');
		if (lower.includes('next')) variations.push('Next.js', 'NextJS');
		
		return variations.filter(v => v.toLowerCase() !== lower);
	}

	// Public method to check service health
	getServiceStatus() {
		return {
			isHealthy: !this.isCircuitBreakerOpen(),
			failures: circuitBreakerState.failures,
			circuitBreakerOpen: circuitBreakerState.isOpen,
			lastFailureTime: circuitBreakerState.lastFailureTime ? new Date(circuitBreakerState.lastFailureTime).toISOString() : null,
			config: {
				maxRetries: config.maxRetries,
				requestTimeout: config.requestTimeout,
				failureThreshold: config.circuitBreakerConfig.failureThreshold
			}
		};
	}

	async validateDocumentationUrl(url: string): Promise<boolean> {
		try {
			const response = await fetch(url);
			if (!response.ok) return false;
			
			const html = await response.text();
			const $ = cheerio.load(html);
			
			// Check for common documentation indicators
			const hasDocIndicators = 
				$('nav').length > 0 ||
				$('.documentation').length > 0 ||
				$('[class*="doc"]').length > 0 ||
				$('h1:contains("Documentation")').length > 0 ||
				$('title:contains("Docs")').length > 0;
			
			return hasDocIndicators;
		} catch (error) {
			return false;
		}
	}
}