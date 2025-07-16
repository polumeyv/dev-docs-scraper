<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	
	export let taskId = null;
	export let visible = false;
	
	const dispatch = createEventDispatcher();
	
	let socket = null;
	let progressData = {
		stage: 'idle',
		message: 'Ready to start',
		progress: 0,
		details: {},
		error: null,
		timestamp: null
	};
	
	let stages = [
		{ id: 'url_analysis', name: 'URL Analysis', icon: '🔍' },
		{ id: 'page_fetch', name: 'Page Fetch', icon: '📥' },
		{ id: 'navigation_extraction', name: 'Navigation Extract', icon: '🗂️' },
		{ id: 'ai_analysis', name: 'AI Analysis', icon: '🤖' },
		{ id: 'validation', name: 'Validation', icon: '✅' },
		{ id: 'complete', name: 'Complete', icon: '🎉' }
	];
	
	let activityFeed = [];
	let dataFlow = {
		inputUrl: null,
		discoveryUrl: null,
		navigationItems: 0,
		sectionsFound: 0,
		topicsFound: 0,
		strategy: 'standard'
	};
	
	onMount(() => {
		if (typeof window !== 'undefined' && taskId) {
			connectWebSocket();
		}
	});
	
	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});
	
	function connectWebSocket() {
		// Connect to WebSocket (simulated for demo)
		socket = {
			on: (event, callback) => {
				// Simulate WebSocket events for demo
				if (event === 'topic_discovery_update') {
					// Demo progress simulation
					simulateProgress();
				}
			},
			disconnect: () => {}
		};
	}
	
	function simulateProgress() {
		// Simulate real-time progress updates
		const progressSteps = [
			{ stage: 'url_analysis', message: 'Analyzing URL for Spring', progress: 10, details: { framework: 'Spring' } },
			{ stage: 'page_fetch', message: 'Fetching documentation page', progress: 20, details: { discovery_url: 'https://spring.io/projects' } },
			{ stage: 'navigation_extraction', message: 'Extracting navigation structure', progress: 40, details: { content_size: 45230 } },
			{ stage: 'ai_analysis', message: 'Analyzing with AI to discover topics', progress: 60, details: { navigation_items: 15, sections_found: 8 } },
			{ stage: 'validation', message: 'Validating and enhancing topics', progress: 90, details: { raw_topics: 6 } },
			{ stage: 'complete', message: 'Successfully discovered 6 topics', progress: 100, details: { final_topics: 6 } }
		];
		
		let stepIndex = 0;
		const interval = setInterval(() => {
			if (stepIndex < progressSteps.length) {
				const step = progressSteps[stepIndex];
				updateProgress(step);
				stepIndex++;
			} else {
				clearInterval(interval);
			}
		}, 1500);
	}
	
	function updateProgress(update) {
		progressData = { ...update, timestamp: Date.now() };
		
		// Add to activity feed
		activityFeed = [
			{
				time: new Date().toLocaleTimeString(),
				stage: update.stage,
				message: update.message,
				details: update.details || {}
			},
			...activityFeed.slice(0, 9) // Keep last 10 items
		];
		
		// Update data flow
		if (update.details) {
			dataFlow = { ...dataFlow, ...update.details };
		}
	}
	
	function getStageStatus(stageId) {
		const currentStageIndex = stages.findIndex(s => s.id === progressData.stage);
		const thisStageIndex = stages.findIndex(s => s.id === stageId);
		
		if (thisStageIndex < currentStageIndex) return 'completed';
		if (thisStageIndex === currentStageIndex) return 'active';
		return 'pending';
	}
	
	function startDemo() {
		progressData = { stage: 'idle', message: 'Starting...', progress: 0 };
		activityFeed = [];
		simulateProgress();
	}
</script>

{#if visible}
	<div class="dashboard-overlay" transition:fade>
		<div class="dashboard-container" transition:fly={{ y: 50, duration: 300 }}>
			<!-- Header -->
			<div class="dashboard-header">
				<h2>🔍 Real-time Documentation Discovery</h2>
				<div class="header-actions">
					<button class="demo-btn" on:click={startDemo}>▶️ Start Demo</button>
					<button class="close-btn" on:click={() => dispatch('close')}>✕</button>
				</div>
			</div>
			
			<!-- Main Dashboard Grid -->
			<div class="dashboard-grid">
				<!-- Progress Visualization -->
				<div class="panel progress-panel">
					<h3>📊 Progress Overview</h3>
					<div class="progress-bar-container">
						<div class="progress-bar">
							<div class="progress-fill" style="width: {progressData.progress}%"></div>
						</div>
						<span class="progress-text">{progressData.progress}%</span>
					</div>
					<p class="current-message">{progressData.message}</p>
				</div>
				
				<!-- Stage Pipeline -->
				<div class="panel stages-panel">
					<h3>🔄 Processing Stages</h3>
					<div class="stages-container">
						{#each stages as stage}
							<div class="stage-item {getStageStatus(stage.id)}" 
								 class:active={progressData.stage === stage.id}>
								<div class="stage-icon">{stage.icon}</div>
								<div class="stage-name">{stage.name}</div>
								{#if getStageStatus(stage.id) === 'completed'}
									<div class="stage-check">✓</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Data Flow Visualization -->
				<div class="panel dataflow-panel">
					<h3>🌊 Data Flow</h3>
					<div class="dataflow-container">
						<div class="flow-item">
							<strong>Input URL:</strong>
							<span class="url-text">{dataFlow.inputUrl || 'spring.io'}</span>
						</div>
						<div class="flow-arrow">↓</div>
						<div class="flow-item">
							<strong>Discovery URL:</strong> 
							<span class="url-text">{dataFlow.discoveryUrl || 'https://spring.io/projects'}</span>
						</div>
						<div class="flow-arrow">↓</div>
						<div class="flow-metrics">
							<div class="metric">
								<span class="metric-value">{dataFlow.navigationItems}</span>
								<span class="metric-label">Navigation Items</span>
							</div>
							<div class="metric">
								<span class="metric-value">{dataFlow.sectionsFound}</span>
								<span class="metric-label">Sections Found</span>
							</div>
						</div>
						<div class="flow-arrow">↓</div>
						<div class="flow-result">
							<strong>Topics Discovered:</strong>
							<span class="topics-count">{dataFlow.topicsFound || 0}</span>
						</div>
					</div>
				</div>
				
				<!-- Live Activity Feed -->
				<div class="panel activity-panel">
					<h3>📝 Live Activity Feed</h3>
					<div class="activity-feed">
						{#each activityFeed as activity}
							<div class="activity-item" transition:fly={{ x: -20, duration: 200 }}>
								<span class="activity-time">{activity.time}</span>
								<span class="activity-stage">{activity.stage}</span>
								<span class="activity-message">{activity.message}</span>
								{#if activity.details && Object.keys(activity.details).length > 0}
									<div class="activity-details">
										{#each Object.entries(activity.details) as [key, value]}
											<span class="detail-item">{key}: {value}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				
				<!-- System Metrics -->
				<div class="panel metrics-panel">
					<h3>⚡ System Metrics</h3>
					<div class="metrics-grid">
						<div class="metric-card">
							<div class="metric-title">Strategy</div>
							<div class="metric-value strategy-{dataFlow.strategy}">{dataFlow.strategy}</div>
						</div>
						<div class="metric-card">
							<div class="metric-title">Processing Time</div>
							<div class="metric-value">{progressData.timestamp ? Math.floor((Date.now() - progressData.timestamp) / 1000) : 0}s</div>
						</div>
						<div class="metric-card">
							<div class="metric-title">Status</div>
							<div class="metric-value status-{progressData.stage}">{progressData.stage.replace('_', ' ')}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.dashboard-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		z-index: 1000;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 20px;
	}
	
	.dashboard-container {
		background: white;
		border-radius: 16px;
		width: 100%;
		max-width: 1200px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
	}
	
	.dashboard-header {
		padding: 24px;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.dashboard-header h2 {
		margin: 0;
		color: #1f2937;
		font-size: 24px;
	}
	
	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	
	.demo-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 12px 24px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		transition: background 0.2s;
	}
	
	.demo-btn:hover {
		background: #2563eb;
	}
	
	.close-btn {
		background: #ef4444;
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 18px;
		transition: background 0.2s;
	}
	
	.close-btn:hover {
		background: #dc2626;
	}
	
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 20px;
		padding: 24px;
	}
	
	.panel {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
	}
	
	.panel h3 {
		margin: 0 0 16px 0;
		color: #374151;
		font-size: 18px;
	}
	
	/* Progress Panel */
	.progress-bar-container {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 16px 0;
	}
	
	.progress-bar {
		flex: 1;
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
		overflow: hidden;
	}
	
	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #1d4ed8);
		transition: width 0.3s ease;
	}
	
	.progress-text {
		font-weight: bold;
		color: #1f2937;
		min-width: 40px;
	}
	
	.current-message {
		color: #6b7280;
		font-style: italic;
		margin: 8px 0 0 0;
	}
	
	/* Stages Panel */
	.stages-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.stage-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		transition: all 0.2s;
	}
	
	.stage-item.pending {
		background: #f3f4f6;
		color: #9ca3af;
	}
	
	.stage-item.active {
		background: #dbeafe;
		color: #1d4ed8;
		border: 2px solid #3b82f6;
	}
	
	.stage-item.completed {
		background: #d1fae5;
		color: #065f46;
	}
	
	.stage-icon {
		font-size: 20px;
	}
	
	.stage-name {
		flex: 1;
		font-weight: 500;
	}
	
	.stage-check {
		color: #059669;
		font-weight: bold;
	}
	
	/* Data Flow Panel */
	.dataflow-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: center;
	}
	
	.flow-item {
		text-align: center;
		padding: 12px;
		background: white;
		border-radius: 8px;
		border: 2px solid #e5e7eb;
		width: 100%;
	}
	
	.flow-arrow {
		font-size: 24px;
		color: #3b82f6;
	}
	
	.url-text {
		color: #3b82f6;
		font-family: monospace;
		font-size: 14px;
	}
	
	.flow-metrics {
		display: flex;
		gap: 20px;
		justify-content: center;
	}
	
	.metric {
		text-align: center;
	}
	
	.metric-value {
		display: block;
		font-size: 24px;
		font-weight: bold;
		color: #1f2937;
	}
	
	.metric-label {
		font-size: 12px;
		color: #6b7280;
	}
	
	.topics-count {
		font-size: 24px;
		font-weight: bold;
		color: #059669;
	}
	
	/* Activity Feed */
	.activity-feed {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.activity-item {
		padding: 12px;
		background: white;
		border-radius: 8px;
		border-left: 4px solid #3b82f6;
	}
	
	.activity-time {
		font-size: 12px;
		color: #6b7280;
		display: block;
	}
	
	.activity-stage {
		font-size: 12px;
		color: #3b82f6;
		text-transform: uppercase;
		font-weight: bold;
	}
	
	.activity-message {
		display: block;
		margin: 4px 0;
		color: #1f2937;
	}
	
	.activity-details {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	
	.detail-item {
		background: #f3f4f6;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		color: #374151;
	}
	
	/* Metrics Panel */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 16px;
	}
	
	.metric-card {
		text-align: center;
		padding: 16px;
		background: white;
		border-radius: 8px;
		border: 2px solid #e5e7eb;
	}
	
	.metric-title {
		font-size: 12px;
		color: #6b7280;
		margin-bottom: 8px;
	}
	
	.metric-value {
		font-size: 18px;
		font-weight: bold;
		color: #1f2937;
	}
	
	.metric-value.strategy-grounding {
		color: #059669;
	}
	
	.metric-value.strategy-code_execution {
		color: #dc2626;
	}
	
	.metric-value.status-complete {
		color: #059669;
	}
	
	.metric-value.status-error {
		color: #dc2626;
	}
</style>