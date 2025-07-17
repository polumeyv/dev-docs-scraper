<script lang="ts">
	import type { DownloadTask } from '$lib/stores/websocket';
	import { websocket } from '$lib/stores/websocket';
	import { X, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-svelte';
	import Button from './Button.svelte';
	
	interface Props {
		task: DownloadTask;
	}
	
	let { task }: Props = $props();
	
	let StatusIcon = $derived(() => {
		switch (task.status) {
			case 'queued':
				return Loader2;
			case 'in_progress':
				return Download;
			case 'completed':
				return CheckCircle;
			case 'error':
				return AlertCircle;
			default:
				return Download;
		}
	});
	
	function getStatusColor() {
		switch (task.status) {
			case 'queued':
				return 'text-neutral-500';
			case 'in_progress':
				return 'text-blue-600 dark:text-blue-400';
			case 'completed':
				return 'text-green-600 dark:text-green-400';
			case 'error':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-neutral-500';
		}
	}
	
	function formatTime(isoString: string) {
		const date = new Date(isoString);
		return date.toLocaleTimeString();
	}
	
	async function handleCancel() {
		await websocket.cancelDownload(task.id);
	}
</script>

<div class="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
	<div class="mb-3 flex items-start justify-between">
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<StatusIcon 
					size={16} 
					class={`${getStatusColor()} ${task.status === 'in_progress' ? 'animate-spin' : ''}`} 
				/>
				<h4 class="text-sm font-medium text-[var(--color-text-primary)]">
					{task.framework}
				</h4>
				<span class="text-xs text-neutral-500">
					{formatTime(task.createdAt)}
				</span>
			</div>
			<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400 truncate">
				{task.url}
			</p>
		</div>
		
		{#if task.status === 'queued' || task.status === 'in_progress'}
			<Button
				variant="ghost"
				size="sm"
				onclick={handleCancel}
				class="ml-2"
			>
				<X size={16} />
			</Button>
		{/if}
	</div>
	
	{#if task.status === 'in_progress' || task.status === 'completed'}
		<div class="space-y-2">
			<div class="flex items-center justify-between text-xs">
				<span class="text-neutral-600 dark:text-neutral-400">
					{task.pagesScraped || 0} / {task.totalPages || 0} pages
				</span>
				<span class="font-medium text-[var(--color-text-primary)]">
					{task.progress}%
				</span>
			</div>
			
			<div class="relative h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
				<div 
					class="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300 ease-out"
					style="width: {task.progress}%"
				></div>
			</div>
		</div>
	{/if}
	
	{#if task.status === 'error' && task.error}
		<p class="mt-2 text-xs text-red-600 dark:text-red-400">
			{task.error}
		</p>
	{/if}
	
	<div class="mt-2 flex items-center justify-between">
		<span class="text-xs text-neutral-500">
			Mode: <span class="font-medium">{task.mode}</span>
		</span>
		<span class={`text-xs font-medium ${getStatusColor()}`}>
			{task.status}
		</span>
	</div>
</div>