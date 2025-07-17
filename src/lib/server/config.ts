import { PRIVATE_GEMINI_API_KEY } from '$env/static/private';
import { PUBLIC_ENV, PUBLIC_API_URL, PUBLIC_API_HOST, PUBLIC_API_PORT, PUBLIC_API_PROTOCOL } from '$env/static/public';
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { APIError, ValidationError, ValidationResult } from '$lib/types/api';

// Environment configuration
const environment = PUBLIC_ENV || 'development';

// Build API URL from components if PUBLIC_API_URL is not provided
function buildApiUrl(): string {
	if (PUBLIC_API_URL) {
		return PUBLIC_API_URL;
	}

	const protocol = PUBLIC_API_PROTOCOL || (environment === 'production' ? 'https' : 'http');
	const host = PUBLIC_API_HOST || (environment === 'production' ? 'docs-scraper.com' : 'localhost');
	const port = PUBLIC_API_PORT || (environment === 'production' ? '' : '5173');
	
	const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
	return `${protocol}://${host}${portSuffix}`;
}

export const config = {
	geminiApiKey: PRIVATE_GEMINI_API_KEY,
	environment,
	apiUrl: buildApiUrl(),
	maxRetries: environment === 'production' ? 5 : 3,
	requestTimeout: environment === 'production' ? 45000 : 30000, // 45s prod, 30s dev
	connectivityTimeout: environment === 'production' ? 15000 : 10000, // 15s prod, 10s dev
	maxConcurrentRequests: environment === 'production' ? 10 : 5,
	circuitBreakerConfig: {
		failureThreshold: environment === 'production' ? 10 : 5,
		resetTimeout: environment === 'production' ? 120000 : 60000, // 2min prod, 1min dev
		monitoringPeriod: 30000 // 30 seconds
	}
};

// Circuit breaker state tracking
export const circuitBreakerState = {
	failures: 0,
	lastFailureTime: 0,
	isOpen: false
};

export async function validateConfig() {
	// Check if API key exists
	if (!config.geminiApiKey) {
		throw new Error('PRIVATE_GEMINI_API_KEY is not set in environment variables');
	}

	// Validate API key format
	if (!validateGeminiApiKeyFormat(config.geminiApiKey)) {
		throw new Error('PRIVATE_GEMINI_API_KEY has invalid format. Expected format: AIza... (39 characters)');
	}

	// Test connectivity to Gemini API (only in non-test environments)
	if (environment !== 'test') {
		try {
			await testGeminiConnectivity();
			console.log('✅ Gemini API connectivity test passed');
		} catch (error) {
			console.warn('⚠️ Gemini API connectivity test failed:', error);
			// Don't throw error for connectivity test failure to allow graceful degradation
		}
	}
}

function validateGeminiApiKeyFormat(apiKey: string): boolean {
	// Gemini API keys typically start with "AIza" and are 39 characters long
	const geminiKeyPattern = /^AIza[A-Za-z0-9_-]{35}$/;
	return geminiKeyPattern.test(apiKey);
}

async function testGeminiConnectivity(): Promise<void> {
	const genAI = new GoogleGenerativeAI(config.geminiApiKey);
	const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

	// Use a controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), config.connectivityTimeout);

	try {
		// Simple test prompt to verify API connectivity
		const result = await model.generateContent({
			contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
		});
		
		clearTimeout(timeoutId);
		
		if (!result.response) {
			throw new Error('No response received from Gemini API');
		}
	} catch (error) {
		clearTimeout(timeoutId);
		throw new Error(`Gemini API connectivity test failed: ${error}`);
	}
}

export function getEnvironmentConfig() {
	return {
		environment: config.environment,
		apiUrl: config.apiUrl,
		maxRetries: config.maxRetries,
		requestTimeout: config.requestTimeout,
		maxConcurrentRequests: config.maxConcurrentRequests,
		isProduction: environment === 'production'
	};
}

// Error response helpers
export function createErrorResponse(error: string, details?: string, status = 500) {
	const errorResponse: APIError = {
		error,
		details,
		timestamp: new Date().toISOString()
	};
	return json(errorResponse, { status });
}

export function createSuccessResponse<T>(data?: T, message?: string, status = 200) {
	const successResponse = {
		data,
		message,
		timestamp: new Date().toISOString()
	};
	return json(successResponse, { status });
}

// Request validation helpers
export function validateRequired(value: any, fieldName: string): ValidationError | null {
	if (!value || (typeof value === 'string' && !value.trim())) {
		return {
			field: fieldName,
			message: `${fieldName} is required`
		};
	}
	return null;
}

export function validateString(value: any, fieldName: string): ValidationError | null {
	if (value !== undefined && typeof value !== 'string') {
		return {
			field: fieldName,
			message: `${fieldName} must be a string`
		};
	}
	return null;
}

export function validateUrl(value: string, fieldName: string): ValidationError | null {
	try {
		new URL(value);
		return null;
	} catch {
		return {
			field: fieldName,
			message: `${fieldName} must be a valid URL`
		};
	}
}

export function collectValidationErrors(...errors: (ValidationError | null)[]): ValidationResult {
	const validErrors = errors.filter(Boolean) as ValidationError[];
	return {
		isValid: validErrors.length === 0,
		errors: validErrors
	};
}