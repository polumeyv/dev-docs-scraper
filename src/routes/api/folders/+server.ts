import { json } from '@sveltejs/kit';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';
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

		return json({ folders });
	} catch (error) {
		console.error('Error listing folders:', error);
		return json(
			{ error: 'Failed to list folders' },
			{ status: 500 }
		);
	}
};

// POST endpoint to create a new folder
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name } = await request.json();
		
		if (!name || typeof name !== 'string') {
			return json(
				{ error: 'Folder name is required' },
				{ status: 400 }
			);
		}

		// Sanitize folder name
		const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '-');
		const folderPath = join(DOCS_DIR, sanitizedName);

		// Create folder
		await mkdir(folderPath, { recursive: true });

		return json({
			name: sanitizedName,
			path: folderPath,
			message: 'Folder created successfully'
		});
	} catch (error) {
		console.error('Error creating folder:', error);
		return json(
			{ error: 'Failed to create folder' },
			{ status: 500 }
		);
	}
};