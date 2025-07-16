# Documentation Scraper - SvelteKit Edition

An intelligent documentation scraper built with SvelteKit that uses AI to discover, analyze, and scrape technical documentation with real-time progress tracking.

## Features

- 🤖 **AI-Powered Documentation Discovery** - Uses Google Gemini to intelligently find official documentation
- 📖 **Smart Topic Discovery** - Automatically discovers and categorizes documentation topics
- 🚀 **Intelligent Scraping** - Two modes: basic scraping and AI-enhanced content extraction
- ⚡ **Real-time Updates** - Server-Sent Events (SSE) for live progress tracking
- 🎯 **Multi-Strategy Search** - DevDocs, official sites, and ReadTheDocs integration
- 🔍 **Content Enhancement** - AI-powered content summarization and key point extraction
- 📱 **Modern UI** - Built with SvelteKit, TypeScript, and TailwindCSS

## Architecture

### Migrated from Python + Docker to Pure SvelteKit

This project was successfully migrated from a Python Flask + Docker architecture to a pure SvelteKit application with:

- **Frontend**: SvelteKit with TypeScript and TailwindCSS
- **Backend**: SvelteKit API routes (no separate backend needed)
- **AI Integration**: Google Gemini API for intelligent content analysis
- **Real-time**: Server-Sent Events replacing WebSocket
- **Deployment**: Single Node.js application (no Docker required)

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/search-docs?q=framework` - Search for documentation
- `POST /api/discover-topics` - Discover topics from a documentation URL
- `POST /api/scrape` - Start scraping documentation
- `GET /api/sse?task_id=xxx` - Subscribe to real-time task updates

## Setup

1. **Clone and Install**
   ```bash
   git clone <your-repo>
   cd docs-scraper
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env file
   echo "PRIVATE_GEMINI_API_KEY=your_gemini_api_key_here" > .env
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm run preview
   ```

## Usage

### 1. Search for Documentation
```javascript
// Search for React documentation
const result = await fetch('/api/search-docs?q=react').then(r => r.json());
// Returns: { framework: "react", official_docs: "https://react.dev/", confidence: 1.0 }
```

### 2. Discover Topics
```javascript
// Discover topics from a documentation URL
const topics = await fetch('/api/discover-topics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://react.dev/learn',
    framework: 'react'
  })
}).then(r => r.json());
```

### 3. Start Scraping
```javascript
// Start intelligent scraping
const task = await fetch('/api/scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://react.dev/learn',
    framework: 'react',
    topic_name: 'React Basics',
    mode: 'intelligent' // or 'basic'
  })
}).then(r => r.json());

// Subscribe to real-time updates
const eventSource = new EventSource(\`/api/sse?task_id=\${task.task_id}\`);
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress:', update);
};
```

## Migration Benefits

### Before (Python + Docker)
- Required Docker and separate backend container
- Complex deployment with multiple services
- WebSocket for real-time updates
- Separate API server management

### After (SvelteKit)
- Single Node.js application
- No Docker required
- Built-in API routes
- Server-Sent Events for real-time updates
- Type-safe throughout with TypeScript
- Better performance with server-side rendering
- Simplified deployment

## Technology Stack

- **Framework**: SvelteKit 2.x
- **Language**: TypeScript
- **Styling**: TailwindCSS 4.x
- **AI**: Google Gemini API
- **Web Scraping**: Cheerio (replacing BeautifulSoup)
- **HTTP Client**: Native Fetch API (replacing aiohttp)
- **Real-time**: Server-Sent Events (replacing WebSocket)

## Deployment Options

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel with environment variables
```

### Node.js Server
```bash
npm run build
node build/index.js
```

### Static Export (if no server features needed)
```bash
# Configure adapter-static in svelte.config.js
npm run build
# Serve the 'build' directory
```

## Environment Variables

- `PRIVATE_GEMINI_API_KEY` - Google Gemini API key for AI features

## Security Notes

- API keys are properly handled as private environment variables
- CORS is configured for API endpoints
- No exposed secrets in client-side code
- Rate limiting can be added to API routes as needed

## Contributing

The codebase is now fully TypeScript with:
- Type-safe API routes
- Shared interfaces between frontend and backend
- Modern async/await patterns
- Error handling with proper HTTP status codes