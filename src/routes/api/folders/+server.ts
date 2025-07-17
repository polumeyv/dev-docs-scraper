import { json } from '@sveltejs/kit';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { 
	createErrorResponse,
	createSuccessResponse,
	validateRequired,
	validateString,
	collectValidationErrors
} from '$lib/server/config';
import type { RequestHandler } from './$types';

const DOCS_DIR = 'static/docs';

// GET endpoint to list folders
export const GET: RequestHandler = async () => {
	try {
		// Ensure docs directory exists
		try {
			await mkdir(DOCS_DIR, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
		}

		// Read folders
		const entries = await readdir(DOCS_DIR, { withFileTypes: true });
		const folders = entries
			.filter(entry => entry.isDirectory())
			.map(entry => ({
				name: entry.name,
				path: join(DOCS_DIR, entry.name)
			}));

		return createSuccessResponse(
			{ folders },
			`Found ${folders.length} folder${folders.length !== 1 ? 's' : ''}`
		);

	} catch (error) {
		console.error('Error listing folders:', error);

		// Handle permission errors
		if (error instanceof Error && error.message.includes('EACCES')) {
			return createErrorResponse(
				'Permission denied',
				'Unable to access docs directory. Please check file permissions.',
				403
			);
		}

		// Handle file system errors
		if (error instanceof Error && error.message.includes('ENOENT')) {
			return createErrorResponse(
				'Directory not found',
				'Docs directory does not exist and could not be created.',
				404
			);
		}
		
		return createErrorResponse(
			'Failed to list folders',
			error instanceof Error ? error.message : 'An unexpected error occurred while listing folders',
			500
		);
	}
};

// POST endpoint to create a new folder
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse and validate request body
		let data;
		try {
			data = await request.json();
		} catch (parseError) {
			return createErrorResponse(
				'Invalid JSON in request body',
				parseError instanceof Error ? parseError.message : 'Request body must be valid JSON',
				400
			);
		}

		const { name } = data;

		// Validate request parameters
		const validation = collectValidationErrors(
			validateRequired(name, 'name'),
			validateString(name, 'name')
		);

		if (!validation.isValid) {
			const errorDetails = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
			return createErrorResponse(
				'Request validation failed',
				errorDetails,
				400
			);
		}

		// Additional validation for folder name
		if (name.length > 100) {
			return createErrorResponse(
				'Invalid folder name',
				'Folder name must be 100 characters or less',
				400
			);
		}

		// Sanitize folder name
		const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '-');
		
		if (sanitizedName.length === 0) {
			return createErrorResponse(
				'Invalid folder name',
				'Folder name must contain at least one alphanumeric character',
				400
			);
		}

		const folderPath = join(DOCS_DIR, sanitizedName);

		// Check if folder already exists
		try {
			const existingEntries = await readdir(DOCS_DIR, { withFileTypes: true });
			const folderExists = existingEntries.some(
				entry => entry.isDirectory() && entry.name === sanitizedName
			);
			
			if (folderExists) {
				return createErrorResponse(
					'Folder already exists',
					`A folder named "${sanitizedName}" already exists`,
					409
				);
			}
		} catch (error) {
			// If we can't read the directory, we'll try to create the folder anyway
		}

		// Create folder
		await mkdir(folderPath, { recursive: true });

		return createSuccessResponse({
			name: sanitizedName,
			path: folderPath,
			originalName: name
		}, 'Folder created successfully');

	} catch (error) {
		console.error('Error creating folder:', error);

		// Handle permission errors
		if (error instanceof Error && error.message.includes('EACCES')) {
			return createErrorResponse(
				'Permission denied',
				'Unable to create folder. Please check file permissions.',
				403
			);
		}

		// Handle disk space errors
		if (error instanceof Error && error.message.includes('ENOSPC')) {
			return createErrorResponse(
				'Insufficient disk space',
				'Unable to create folder due to insufficient disk space.',
				507
			);
		}
		
		return createErrorResponse(
			'Failed to create folder',
			error instanceof Error ? error.message : 'An unexpected error occurred while creating the folder',
			500
		);
	}
};