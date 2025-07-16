import * as cheerio from 'cheerio';
import { progressTracker, type ProgressCallback } from './progressTracker';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ScrapedPage {
	url: string;
	title: string;
	content: string;
	links: string[];
}

export class ScraperService {
	private visitedUrls = new Set<string>();
	private maxPages = 100;
	private baseUrl: string = '';
	private baseDomain: string = '';

	async scrapeDocumentation(
		taskId: string, 
		startUrl: string, 
		framework: string,
		progressCallback?: ProgressCallback
	): Promise<void> {
		this.baseUrl = startUrl;
		this.baseDomain = new URL(startUrl).hostname;
		this.visitedUrls.clear();

		if (progressCallback) {
			progressTracker.registerCallback(taskId, progressCallback);
		}

		try {
			await progressTracker.updateProgress(taskId, {
				status: 'in_progress',
				progress: 0,
				message: `Starting documentation scrape for ${framework}...`
			});

			const queue: string[] = [startUrl];
			const scrapedPages: ScrapedPage[] = [];

			while (queue.length > 0 && this.visitedUrls.size < this.maxPages) {
				const url = queue.shift()!;
				
				if (this.visitedUrls.has(url)) continue;
				this.visitedUrls.add(url);

				try {
					const page = await this.scrapePage(url);
					if (page) {
						scrapedPages.push(page);
						
						// Add new links to queue
						const newLinks = page.links.filter(link => 
							!this.visitedUrls.has(link) && 
							this.isSameDomain(link) &&
							this.isDocumentationUrl(link)
						);
						queue.push(...newLinks);

						// Update progress
						const progress = Math.min(
							(this.visitedUrls.size / this.maxPages) * 100,
							99
						);
						
						await progressTracker.updateProgress(taskId, {
							progress,
							message: `Scraped ${this.visitedUrls.size} pages...`,
							pagesScraped: this.visitedUrls.size,
							totalPages: Math.min(queue.length + this.visitedUrls.size, this.maxPages)
						});
					}
				} catch (error) {
					console.error(`Error scraping ${url}:`, error);
				}

				// Rate limiting
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			// Save scraped content
			await this.saveScrapedContent(framework, scrapedPages);

			await progressTracker.reportComplete(taskId, 
				`Successfully scraped ${scrapedPages.length} pages for ${framework}`
			);

		} catch (error) {
			await progressTracker.reportError(taskId, 
				error instanceof Error ? error.message : 'Unknown error occurred'
			);
		} finally {
			progressTracker.unregisterCallback(taskId);
		}
	}

	private async scrapePage(url: string): Promise<ScrapedPage | null> {
		try {
			const response = await fetch(url);
			if (!response.ok) return null;

			const html = await response.text();
			const $ = cheerio.load(html);

			// Remove script and style elements
			$('script, style, noscript').remove();

			// Extract title
			const title = $('title').text() || $('h1').first().text() || 'Untitled';

			// Extract main content
			const contentSelectors = [
				'main', 
				'article', 
				'[role="main"]',
				'.documentation',
				'.content',
				'#content'
			];
			
			let content = '';
			for (const selector of contentSelectors) {
				const element = $(selector);
				if (element.length > 0) {
					content = element.text().trim();
					break;
				}
			}

			// Fallback to body if no specific content area found
			if (!content) {
				content = $('body').text().trim();
			}

			// Extract links
			const links: string[] = [];
			$('a[href]').each((_, element) => {
				const href = $(element).attr('href');
				if (href) {
					const absoluteUrl = new URL(href, url).toString();
					links.push(absoluteUrl);
				}
			});

			return {
				url,
				title: title.trim(),
				content: this.cleanContent(content),
				links: [...new Set(links)] // Remove duplicates
			};

		} catch (error) {
			console.error(`Failed to scrape ${url}:`, error);
			return null;
		}
	}

	private cleanContent(content: string): string {
		return content
			.replace(/\s+/g, ' ')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
			.slice(0, 50000); // Limit content size
	}

	private isSameDomain(url: string): boolean {
		try {
			const urlDomain = new URL(url).hostname;
			return urlDomain === this.baseDomain || 
				   urlDomain.endsWith(`.${this.baseDomain}`);
		} catch {
			return false;
		}
	}

	private isDocumentationUrl(url: string): boolean {
		const docPatterns = [
			/\/docs?\//i,
			/\/documentation/i,
			/\/guide/i,
			/\/tutorial/i,
			/\/manual/i,
			/\/reference/i,
			/\/api/i
		];

		const excludePatterns = [
			/\.(pdf|zip|tar|gz|exe|dmg)$/i,
			/\/download/i,
			/\/signin/i,
			/\/login/i,
			/\/register/i
		];

		return docPatterns.some(pattern => pattern.test(url)) &&
			   !excludePatterns.some(pattern => pattern.test(url));
	}

	private async saveScrapedContent(framework: string, pages: ScrapedPage[]): Promise<void> {
		// In development/serverless environments, we'll just log the content
		// In production, you might want to save to a database or cloud storage
		
		try {
			const outputDir = path.join(process.cwd(), 'static', 'docs', framework.toLowerCase());
			
			// Try to create directory and save files
			await fs.mkdir(outputDir, { recursive: true });

			// Save index file with all URLs
			const index = pages.map(p => ({
				url: p.url,
				title: p.title,
				wordCount: p.content.split(/\s+/).length
			}));

			await fs.writeFile(
				path.join(outputDir, 'index.json'),
				JSON.stringify(index, null, 2)
			);

			// Save individual pages
			for (let i = 0; i < pages.length; i++) {
				const page = pages[i];
				const filename = `page_${i + 1}.json`;
				
				await fs.writeFile(
					path.join(outputDir, filename),
					JSON.stringify(page, null, 2)
				);
			}

			console.log(`Saved ${pages.length} pages to ${outputDir}`);
		} catch (error) {
			// Fallback: just log the scraped content
			console.log('Could not save to filesystem, logging scraped content:');
			console.log(`Framework: ${framework}`);
			console.log(`Pages scraped: ${pages.length}`);
			console.log('Sample pages:', pages.slice(0, 3).map(p => ({ url: p.url, title: p.title })));
			
			// Don't throw error, just continue
		}
	}
}