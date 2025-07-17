# Issue #5: Fix Real-time Updates Integration and SSE Memory Leaks

**GitHub Issue**: https://github.com/polumeyv/docs-scraper/issues/5

## Problem Analysis

After investigating the SSE (Server-Sent Events) system, I've identified the core issues:

### 1. Missing SSE Integration in discover-topics
- **File**: `src/routes/api/discover-topics/+server.ts:58-64`
- **Issue**: Progress callback just logs to console instead of emitting SSE events
- **Impact**: Topic discovery progress updates don't reach frontend via SSE

### 2. SSE Memory Leaks
- **File**: `src/lib/stores/api.ts`
- **Issue**: EventSource connections not automatically cleaned up on component unmount
- **Impact**: Memory leaks accumulate as users navigate between pages

### 3. Missing Error Handling & Connection Management
- **File**: `src/routes/api/sse/+server.ts`
- **Issue**: Good basic implementation but could use better error handling
- **Impact**: Connections may not recover gracefully from errors

### 4. Event Coordination Issues
- **Root Cause**: `discover-topics` endpoint doesn't use `taskEvents` emitter
- **Impact**: Real-time progress updates don't work for topic discovery

## Implementation Plan

### Phase 1: Fix discover-topics SSE Integration (15 min)
1. **Replace console.log with taskEvents.emit** in `discover-topics/+server.ts:58-64`
   - Import `taskEvents` from `$lib/server/taskEvents`
   - Replace `console.log` with `taskEvents.emit(taskId, update)`
   - Ensure progress callback actually emits SSE events

2. **Test real-time topic discovery updates**
   - Start topic discovery with SSE connection
   - Verify progress updates appear in frontend

### Phase 2: Fix SSE Memory Leaks (20 min)
1. **Add automatic cleanup on component unmount**
   - Find components using the `api` store
   - Add `onDestroy` lifecycle to call `api.cleanup()`
   - Ensure EventSource connections are closed on navigation

2. **Improve connection timeout and retry logic**
   - Add connection timeout in `api.ts:subscribeToTask`
   - Implement retry logic for failed connections
   - Better error handling for connection failures

### Phase 3: Enhance SSE Error Handling (15 min)
1. **Improve SSE endpoint error handling**
   - Add better error logging in `sse/+server.ts`
   - Implement connection status tracking
   - Ensure proper cleanup on client disconnect

2. **Add heartbeat improvements**
   - Current 30s heartbeat is good
   - Add client-side heartbeat timeout detection
   - Auto-reconnect on heartbeat failures

### Phase 4: Test Real-time Updates (20 min)
1. **Manual testing with browser**
   - Test topic discovery progress updates
   - Test scraping progress updates
   - Test error states and completion
   - Test page navigation cleanup

2. **Write basic integration test**
   - Test SSE connection establishment
   - Test task update events
   - Test proper cleanup

## Files to Modify

### Primary Changes
- `src/routes/api/discover-topics/+server.ts` - integrate SSE (lines 58-64)
- `src/lib/stores/api.ts` - improve cleanup and memory leak prevention
- `src/routes/api/sse/+server.ts` - enhance error handling

### Component Updates (if needed)
- Any components using `api` store - add `onDestroy` cleanup
- Main app component - ensure global cleanup on app unmount

## Success Criteria

1. ✅ Topic discovery emits real-time progress updates via SSE
2. ✅ No memory leaks from EventSource connections
3. ✅ Proper connection cleanup on page navigation
4. ✅ Error states handled gracefully with reconnection
5. ✅ All real-time operations work consistently

## Implementation Order

1. Fix discover-topics SSE integration (highest impact)
2. Add component cleanup logic
3. Improve SSE error handling
4. Test end-to-end functionality
5. Write basic tests

## Technical Notes

- `taskEvents` emitter is already well implemented
- SSE endpoint has good basic structure
- Main issue is missing integration in discover-topics
- Store architecture is actually well organized (websocket.ts and scraping.ts are proper thin wrappers)

## Risk Assessment

- **Low Risk**: Changes are focused and well-contained
- **Testing**: Manual testing with browser dev tools will be sufficient
- **Rollback**: Easy to revert individual changes if issues arise