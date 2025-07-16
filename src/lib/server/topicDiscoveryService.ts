import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import * as cheerio from 'cheerio';
import { progressTracker, type ProgressCallback } from './progressTracker';

interface Topic {
	name: string;
	url: string;
	description: string;
	importance: 'high' | 'medium' | 'low';
	category: string;
}

export class TopicDiscoveryService {
	private genAI: GoogleGenerativeAI;
	private model: any;

	constructor() {
		this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
	}

	async discoverTopics(
		url: string, 
		framework: string,
		taskId?: string,
		progressCallback?: ProgressCallback
	): Promise<{ topics: Topic[], categories: string[] }> {
		if (taskId && progressCallback) {
			progressTracker.registerCallback(taskId, progressCallback);
		}

		try {
			// Step 1: Fetch and parse the documentation page
			if (taskId) {
				await progressTracker.updateProgress(taskId, {
					progress: 10,
					message: 'Fetching documentation page...'
				});
			}

			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);

			// Step 2: Extract navigation and content structure
			if (taskId) {
				await progressTracker.updateProgress(taskId, {
					progress: 30,
					message: 'Analyzing page structure...'
				});
			}

			const navigationLinks = this.extractNavigationLinks($, url);
			const pageContent = this.extractPageContent($);

			// Step 3: Use AI to analyze and categorize topics
			if (taskId) {
				await progressTracker.updateProgress(taskId, {
					progress: 50,
					message: 'Using AI to discover topics...'
				});
			}

			const topics = await this.analyzeWithAI(framework, navigationLinks, pageContent);

			// Step 4: Organize by categories
			if (taskId) {
				await progressTracker.updateProgress(taskId, {
					progress: 80,
					message: 'Organizing topics by category...'
				});
			}

			const categories = [...new Set(topics.map(t => t.category))];

			if (taskId) {
				await progressTracker.reportComplete(taskId, 
					`Discovered ${topics.length} topics in ${categories.length} categories`
				);
			}

			return { topics, categories };

		} catch (error) {
			if (taskId) {
				await progressTracker.reportError(taskId, 
					error instanceof Error ? error.message : 'Topic discovery failed'
				);
			}
			throw error;
		} finally {
			if (taskId) {
				progressTracker.unregisterCallback(taskId);
			}
		}
	}

	private extractNavigationLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{text: string, href: string}> {
		const links: Array<{text: string, href: string}> = [];
		
		// Common navigation selectors
		const navSelectors = [
			'nav a',
			'.navigation a',
			'.sidebar a',
			'.menu a',
			'[role="navigation"] a',
			'.docs-sidebar a'
		];

		navSelectors.forEach(selector => {
			$(selector).each((_, element) => {
				const $link = $(element);
				const href = $link.attr('href');
				const text = $link.text().trim();
				
				if (href && text) {
					const absoluteUrl = new URL(href, baseUrl).toString();
					links.push({ text, href: absoluteUrl });
				}
			});
		});

		// Remove duplicates
		const uniqueLinks = Array.from(
			new Map(links.map(link => [link.href, link])).values()
		);

		return uniqueLinks;
	}

	private extractPageContent($: cheerio.CheerioAPI): string {
		// Remove non-content elements
		$('script, style, nav, header, footer').remove();
		
		// Extract main content
		const contentSelectors = [
			'main',
			'article',
			'.content',
			'.documentation',
			'[role="main"]'
		];

		for (const selector of contentSelectors) {
			const content = $(selector).text();
			if (content && content.length > 100) {
				return content.slice(0, 5000); // Limit for AI processing
			}
		}

		// Fallback to body
		return $('body').text().slice(0, 5000);
	}

	private async analyzeWithAI(
		framework: string,
		links: Array<{text: string, href: string}>,
		pageContent: string
	): Promise<Topic[]> {
		const linksList = links.map(l => `- ${l.text}: ${l.href}`).join('\n');
		
		const prompt = `Analyze this ${framework} documentation and identify the main topics that developers need to learn.

Navigation Links:
${linksList}

Page Content Preview:
${pageContent.slice(0, 2000)}

Please identify the most important documentation topics and return them as a JSON array with this structure:
[
  {
    "name": "Topic Name",
    "url": "documentation URL",
    "description": "Brief description of what this topic covers",
    "importance": "high|medium|low",
    "category": "Category name (e.g., Getting Started, Core Concepts, API Reference, etc.)"
  }
]

Focus on:
1. Getting started guides
2. Core concepts and fundamentals
3. API references
4. Best practices
5. Common patterns
6. Configuration options

Return only the JSON array, no additional text.`;

		try {
			const result = await this.model.generateContent(prompt);
			const responseText = result.response.text();
			
			// Extract JSON from response
			const jsonMatch = responseText.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				const topics = JSON.parse(jsonMatch[0]);
				
				// Validate and clean topics
				return topics.map((topic: any) => ({
					name: topic.name || 'Unknown Topic',
					url: topic.url || '',
					description: topic.description || '',
					importance: topic.importance || 'medium',
					category: topic.category || 'General'
				})).filter((topic: Topic) => topic.url && topic.name);
			}
			
		} catch (error) {
			console.error('AI analysis error:', error);
		}

		// Fallback: Create topics from navigation links
		return links.slice(0, 20).map(link => ({
			name: link.text,
			url: link.href,
			description: `Documentation for ${link.text}`,
			importance: 'medium' as const,
			category: this.guessCategory(link.text)
		}));
	}

	private guessCategory(text: string): string {
		const lower = text.toLowerCase();
		
		if (lower.includes('start') || lower.includes('introduction')) return 'Getting Started';
		if (lower.includes('api') || lower.includes('reference')) return 'API Reference';
		if (lower.includes('guide') || lower.includes('tutorial')) return 'Guides';
		if (lower.includes('config') || lower.includes('setup')) return 'Configuration';
		if (lower.includes('example') || lower.includes('demo')) return 'Examples';
		
		return 'Documentation';
	}
}