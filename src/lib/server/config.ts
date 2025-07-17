import { PRIVATE_GEMINI_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import type { APIError, ValidationError, ValidationResult } from '$lib/types/api';

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