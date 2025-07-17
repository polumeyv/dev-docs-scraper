# Issue #4: Fix API Error Handling and Missing Endpoints

**GitHub Issue**: https://github.com/polumeyv/docs-scraper/issues/4

## Problem Analysis

After thorough investigation of the codebase, the issue description contains inaccuracies:
- The `/api/folders` endpoint **already exists** and is properly implemented
- The real issues are inconsistent error handling and frontend crash vulnerabilities

## Root Causes Identified

### 1. Inconsistent Error Response Formats
Current endpoints return different error structures:
- `/api/folders` returns `{ error: string }`
- `/api/scrape` returns `{ error: string, details?: string }`
- `/api/search-docs` returns `{ framework: string, links: [], error: string, details?: string }`

### 2. Frontend Crash Vulnerabilities
- Unhandled promise rejections in API calls
- Missing timeouts on fetch requests
- EventSource/WebSocket connections not properly cleaned up
- Race conditions during component unmounting

### 3. Inadequate Error Details
- Generic error messages like "Internal Error"
- Missing validation error specifics
- No timestamp tracking for debugging

## Implementation Plan

### Phase 1: Standardize Error Response Format (15 min)
1. Create standard error interface in `src/lib/types/api.ts`
2. Create error response helper in `src/lib/server/config.ts`
3. Update all API endpoints to use standardized format

### Phase 2: Improve API Error Handling (25 min)
1. Add comprehensive request validation to all endpoints
2. Improve error messages with specific details
3. Add timeout handling for external API calls
4. Add try-catch blocks around all async operations

### Phase 3: Fix Frontend Error Handling (30 min)
1. Add request timeouts to all fetch calls
2. Implement proper cleanup for EventSource connections
3. Add error boundaries for API calls
4. Fix WebSocket connection handling in topics page

### Phase 4: Testing & Validation (20 min)
1. Test all API endpoints manually
2. Test error scenarios (invalid data, timeouts)
3. Test frontend error handling with browser dev tools
4. Run existing test suite

## Files to Modify

### New Files
- `src/lib/types/api.ts` - Standard API types and interfaces

### Modified Files
- `src/lib/server/config.ts` - Add error response helpers and validation
- `src/routes/api/folders/+server.ts` - Standardize error format
- `src/routes/api/scrape/+server.ts` - Improve error handling and validation
- `src/routes/api/discover-topics/+server.ts` - Standardize error format
- `src/routes/api/search-docs/+server.ts` - Improve error handling
- `src/routes/+page.svelte` - Add timeouts and error handling
- `src/routes/topics/+page.svelte` - Fix WebSocket cleanup
- `src/lib/stores/api.ts` - Improve EventSource error handling

## Success Criteria

1. ✅ All API endpoints return consistent error format:
   ```typescript
   interface APIError {
     error: string;
     details?: string;
     timestamp: string;
   }
   ```

2. ✅ No runtime crashes when frontend calls API endpoints
3. ✅ Specific, actionable error messages for users
4. ✅ All API endpoints handle errors gracefully
5. ✅ Proper cleanup of WebSocket/EventSource connections
6. ✅ Request timeouts prevent hanging requests

## Implementation Order

1. Create standard types and helpers
2. Update `/api/scrape` endpoint (highest impact)
3. Update `/api/discover-topics` endpoint 
4. Update `/api/search-docs` endpoint
5. Update `/api/folders` endpoint
6. Fix frontend error handling in main page
7. Fix frontend error handling in topics page
8. Update API store error handling
9. Test all changes thoroughly

## Notes

- The `/api/folders` endpoint is already working correctly
- Focus on standardization rather than creating new functionality
- Priority is preventing crashes and improving error messages
- All changes should be backward compatible