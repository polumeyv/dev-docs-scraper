import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
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

				const result = await this.model.generateContent(prompt);
				const bestUrl = result.response.text().trim();
				
				const bestResult = validResults.find(r => r.url === bestUrl) || validResults[0];
				
				return {
					framework,
					official_docs: bestResult.url,
					confidence: bestResult.confidence || 0.8,
					alternatives: validResults.filter(r => r.url !== bestResult.url).map(r => r.url)
				};
			}

			// If no results, use AI to suggest
			return await this.intelligentSearch(framework);
		} catch (error) {
			console.error('Intelligent doc finder error:', error);
			
			// Fallback to basic search
			const results = await this.docSearchService.searchDocumentation(framework);
			const validResult = results.find(r => r.url);
			
			if (validResult) {
				return {
					framework,
					official_docs: validResult.url,
					confidence: validResult.confidence || 0.5
				};
			}
			
			return {
				framework,
				error: 'Could not find documentation',
				suggestions: this.getCommonFrameworkVariations(framework)
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
			const result = await this.model.generateContent(prompt);
			const responseText = result.response.text();
			
			// Extract JSON from response
			const jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const data = JSON.parse(jsonMatch[0]);
				return {
					framework,
					official_docs: data.url,
					confidence: data.confidence || 0.7,
					corrected_name: data.corrected_name
				};
			}
		} catch (error) {
			console.error('AI search error:', error);
		}

		return {
			framework,
			error: 'Could not determine documentation URL',
			suggestions: this.getCommonFrameworkVariations(framework)
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