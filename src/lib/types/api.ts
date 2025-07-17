// Standard API response types

export interface APIError {
	error: string;
	details?: string;
	timestamp: string;
}

export interface APISuccess<T = any> {
	data?: T;
	message?: string;
	timestamp: string;
}

export type APIResponse<T = any> = APISuccess<T> | APIError;

// Helper to check if response is an error
export function isAPIError(response: APIResponse): response is APIError {
	return 'error' in response;
}

// Request validation types
export interface ValidationError {
	field: string;
	message: string;
}

export interface ValidationResult {
	isValid: boolean;
	errors: ValidationError[];
}