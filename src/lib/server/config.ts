import { PRIVATE_GEMINI_API_KEY } from '$env/static/private';
import { PUBLIC_ENV, PUBLIC_API_URL } from '$env/static/public';
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { APIError, ValidationError, ValidationResult } from '$lib/types/api';

// Environment configuration
const environment = PUBLIC_ENV || 'development';

export const config = {
	geminiApiKey: PRIVATE_GEMINI_API_KEY,
	environment,
	apiUrl: PUBLIC_API_URL || 'http://localhost:5173',
	maxRetries: 3,
	requestTimeout: environment === 'production' ? 45000 : 30000, // 45s prod, 30s dev
	connectivityTimeout: 10000, // 10 seconds for connectivity tests
	maxConcurrentRequests: environment === 'production' ? 10 : 5,
	circuitBreakerConfig: {
		failureThreshold: 5,
		resetTimeout: 60000, // 1 minute
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