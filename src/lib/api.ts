// Legacy API wrapper for backward compatibility
// This redirects old fetch calls to the new SvelteKit API routes

export async function searchDocs(framework: string) {
	const response = await fetch(`/api/search-docs?q=${encodeURIComponent(framework)}`);
	return response.json();
}

export async function discoverTopics(url: string, framework: string, taskId?: string) {
	const response = await fetch('/api/discover-topics', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url, framework, task_id: taskId })
	});
	return response.json();
}

export async function startScraping(
	url: string, 
	framework: string, 
	topicName?: string, 
	mode: 'intelligent' | 'basic' = 'intelligent'
) {
	const response = await fetch('/api/scrape', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			url, 
			framework, 
			topic_name: topicName,
			mode 
		})
	});
	return response.json();
}

export async function healthCheck() {
	const response = await fetch('/api/health');
	return response.json();
}