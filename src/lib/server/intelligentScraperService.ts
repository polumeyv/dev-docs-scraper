import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import { ScraperService } from './scraperService';
import { TopicDiscoveryService } from './topicDiscoveryService';
import { progressTracker, type ProgressCallback } from './progressTracker';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ScrapingPlan {
	urls: string[];
	priority: 'high' | 'medium' | 'low';
	category: string;
}

export class IntelligentScraperService {
	private genAI: GoogleGenerativeAI;
	private model: any;
	private scraperService: ScraperService;
	private topicService: TopicDiscoveryService;
	private scrapedContent = new Map<string, any>();

	constructor() {
		this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
		this.scraperService = new ScraperService();
		this.topicService = new TopicDiscoveryService();
	}

	async scrapeTopic(
		taskId: string,
		url: string,
		topicName: string,
		framework: string,
		progressCallback?: ProgressCallback
	): Promise<void> {
		if (progressCallback) {
			progressTracker.registerCallback(taskId, progressCallback);
		}

		try {
			// Step 1: Discover topics to understand what to scrape
			await progressTracker.updateProgress(taskId, {
				progress: 10,
				message: 'Discovering related topics...'
			});

			const { topics } = await this.topicService.discoverTopics(url, framework);

			// Step 2: Create intelligent scraping plan
			await progressTracker.updateProgress(taskId, {
				progress: 20,
				message: 'Creating intelligent scraping plan...'
			});

			const scrapingPlan = await this.createScrapingPlan(topics, topicName, framework);

			// Step 3: Execute intelligent scraping
			await progressTracker.updateProgress(taskId, {
				progress: 30,
				message: 'Starting intelligent scraping...'
			});

			await this.executePlan(taskId, scrapingPlan, framework);

			// Step 4: Process and enhance content
			await progressTracker.updateProgress(taskId, {
				progress: 80,
				message: 'Processing and enhancing content...'
			});

			await this.processScrapedContent(framework, topicName);

			await progressTracker.reportComplete(taskId,
				`Successfully scraped and processed ${topicName} documentation`
			);

		} catch (error) {
			await progressTracker.reportError(taskId,
				error instanceof Error ? error.message : 'Intelligent scraping failed'
			);
		} finally {
			progressTracker.unregisterCallback(taskId);
		}
	}

	private async createScrapingPlan(
		topics: Array<any>,
		topicName: string,
		framework: string
	): Promise<ScrapingPlan[]> {
		const prompt = `Given these documentation topics for ${framework}:
${topics.map(t => `- ${t.name}: ${t.url} (${t.importance})`).join('\n')}

Create a prioritized scraping plan focusing on "${topicName}". 
Return a JSON array of scraping plans with this structure:
[
  {
    "urls": ["url1", "url2"],
    "priority": "high|medium|low",
    "category": "category name"
  }
]

Prioritize:
1. Topics directly related to "${topicName}"
2. Core concepts and fundamentals
3. Getting started guides
4. API references related to the topic

Return only the JSON array.`;

		try {
			const result = await this.model.generateContent(prompt);
			const responseText = result.response.text();
			
			const jsonMatch = responseText.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[0]);
			}
		} catch (error) {
			console.error('Error creating scraping plan:', error);
		}

		// Fallback plan
		return [{
			urls: topics.slice(0, 10).map(t => t.url),
			priority: 'high' as const,
			category: 'General'
		}];
	}

	private async executePlan(
		taskId: string,
		plans: ScrapingPlan[],
		framework: string
	): Promise<void> {
		// Sort plans by priority
		const sortedPlans = plans.sort((a, b) => {
			const priorities = { high: 3, medium: 2, low: 1 };
			return priorities[b.priority] - priorities[a.priority];
		});

		let totalUrls = 0;
		let processedUrls = 0;

		// Count total URLs for progress tracking
		sortedPlans.forEach(plan => totalUrls += plan.urls.length);

		for (const plan of sortedPlans) {
			for (const url of plan.urls) {
				try {
					await progressTracker.updateProgress(taskId, {
						progress: 30 + (processedUrls / totalUrls) * 40,
						message: `Scraping: ${new URL(url).pathname}...`,
						pagesScraped: processedUrls,
						totalPages: totalUrls
					});

					const content = await this.scrapePageIntelligently(url, framework);
					if (content) {
						this.scrapedContent.set(url, {
							...content,
							category: plan.category,
							priority: plan.priority
						});
					}

					processedUrls++;

					// Rate limiting
					await new Promise(resolve => setTimeout(resolve, 1000));

				} catch (error) {
					console.error(`Error scraping ${url}:`, error);
				}
			}
		}
	}

	private async scrapePageIntelligently(url: string, framework: string): Promise<any> {
		try {
			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);

			// Remove unnecessary elements
			$('script, style, nav, header, footer, .advertisement').remove();

			// Extract structured content
			const title = $('title').text() || $('h1').first().text();
			const headings = this.extractHeadings($);
			const codeBlocks = this.extractCodeBlocks($);
			const content = this.extractMainContent($);

			// Use AI to enhance content extraction
			const enhancedContent = await this.enhanceContentWithAI(
				{ title, content, codeBlocks, headings },
				framework
			);

			return {
				url,
				title,
				content: enhancedContent.content,
				codeBlocks: enhancedContent.codeBlocks,
				headings,
				summary: enhancedContent.summary,
				keypoints: enhancedContent.keypoints,
				scrapedAt: new Date().toISOString()
			};

		} catch (error) {
			console.error(`Failed to scrape ${url}:`, error);
			return null;
		}
	}

	private extractHeadings($: cheerio.CheerioAPI): Array<{level: number, text: string}> {
		const headings: Array<{level: number, text: string}> = [];
		
		$('h1, h2, h3, h4, h5, h6').each((_, element) => {
			const $heading = $(element);
			const tagName = $heading.prop('tagName');
			const level = parseInt((tagName || 'H1').substring(1));
			const text = $heading.text().trim();
			
			if (text) {
				headings.push({ level, text });
			}
		});

		return headings;
	}

	private extractCodeBlocks($: cheerio.CheerioAPI): Array<{language: string, code: string}> {
		const codeBlocks: Array<{language: string, code: string}> = [];
		
		$('pre code, .highlight code, .code-block').each((_, element) => {
			const $code = $(element);
			const code = $code.text().trim();
			
			if (code) {
				// Try to detect language from class names
				const classes = $code.attr('class') || '';
				const languageMatch = classes.match(/language-(\w+)|lang-(\w+)/);
				const language = languageMatch ? (languageMatch[1] || languageMatch[2]) : 'text';
				
				codeBlocks.push({ language, code });
			}
		});

		return codeBlocks;
	}

	private extractMainContent($: cheerio.CheerioAPI): string {
		const contentSelectors = [
			'main',
			'article',
			'.content',
			'.documentation',
			'[role="main"]',
			'.main-content'
		];

		for (const selector of contentSelectors) {
			const content = $(selector).text();
			if (content && content.length > 100) {
				return content.trim();
			}
		}

		return $('body').text().trim();
	}

	private async enhanceContentWithAI(
		content: any,
		framework: string
	): Promise<any> {
		const prompt = `Analyze this ${framework} documentation content and enhance it:

Title: ${content.title}
Content: ${content.content.slice(0, 3000)}
Code blocks: ${content.codeBlocks.length} found

Please provide:
1. A concise summary (2-3 sentences)
2. Key points (bullet list of main concepts)
3. Clean, focused content (remove navigation, ads, etc.)

Return as JSON:
{
  "summary": "Brief summary",
  "keypoints": ["point 1", "point 2"],
  "content": "cleaned content",
  "codeBlocks": [enhanced code blocks with better language detection]
}`;

		try {
			const result = await this.model.generateContent(prompt);
			const responseText = result.response.text();
			
			const jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const enhanced = JSON.parse(jsonMatch[0]);
				return {
					summary: enhanced.summary || 'No summary available',
					keypoints: enhanced.keypoints || [],
					content: enhanced.content || content.content,
					codeBlocks: enhanced.codeBlocks || content.codeBlocks
				};
			}
		} catch (error) {
			console.error('Error enhancing content with AI:', error);
		}

		// Fallback
		return {
			summary: content.title,
			keypoints: [],
			content: content.content,
			codeBlocks: content.codeBlocks
		};
	}

	private async processScrapedContent(framework: string, topicName: string): Promise<void> {
		try {
			const outputDir = path.join(process.cwd(), 'static', 'docs', framework.toLowerCase());
			
			// Convert scraped content to array
			const pages = Array.from(this.scrapedContent.entries()).map(([url, content]) => ({
				url,
				...content
			}));

			// Create enhanced index with AI analysis
			const index = {
				framework,
				topic: topicName,
				scrapedAt: new Date().toISOString(),
				totalPages: pages.length,
				categories: [...new Set(pages.map(p => p.category))],
				summary: await this.createTopicSummary(pages, framework, topicName),
				pages: pages.map(p => ({
					url: p.url,
					title: p.title,
					category: p.category,
					priority: p.priority,
					summary: p.summary,
					keypoints: p.keypoints
				}))
			};

			try {
				await fs.mkdir(outputDir, { recursive: true });

				// Save enhanced index
				await fs.writeFile(
					path.join(outputDir, `${topicName.toLowerCase().replace(/\s+/g, '-')}-index.json`),
					JSON.stringify(index, null, 2)
				);

				// Save individual pages with full content
				for (let i = 0; i < pages.length; i++) {
					const page = pages[i];
					const filename = `${topicName.toLowerCase().replace(/\s+/g, '-')}-page-${i + 1}.json`;
					
					await fs.writeFile(
						path.join(outputDir, filename),
						JSON.stringify(page, null, 2)
					);
				}
				
				console.log(`Saved enhanced content for ${topicName} (${pages.length} pages)`);
			} catch (fsError) {
				// Fallback: just log the processed content
				console.log('Could not save to filesystem, logging processed content:');
				console.log(`Framework: ${framework}, Topic: ${topicName}`);
				console.log(`Enhanced index:`, JSON.stringify(index, null, 2));
			}

		} catch (error) {
			console.error('Error processing scraped content:', error);
			// Don't throw error, just continue
		}
	}

	private async createTopicSummary(pages: any[], framework: string, topicName: string): Promise<string> {
		const summaries = pages.map(p => p.summary).join('\n');
		
		const prompt = `Create a comprehensive summary for "${topicName}" in ${framework} based on these page summaries:

${summaries}

Provide a clear, informative summary that explains what developers need to know about this topic.`;

		try {
			const result = await this.model.generateContent(prompt);
			return result.response.text().trim();
		} catch (error) {
			return `Documentation for ${topicName} in ${framework}`;
		}
	}
}