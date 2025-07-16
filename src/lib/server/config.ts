import { PRIVATE_GEMINI_API_KEY } from '$env/static/private';

export const config = {
	geminiApiKey: PRIVATE_GEMINI_API_KEY,
	maxRetries: 3,
	requestTimeout: 30000, // 30 seconds
	maxConcurrentRequests: 5
};

export function validateConfig() {
	if (!config.geminiApiKey) {
		throw new Error('PRIVATE_GEMINI_API_KEY is not set in environment variables');
	}
}