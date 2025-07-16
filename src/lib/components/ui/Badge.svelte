<script lang="ts">
	interface Props {
		type: 'official' | 'api' | 'tutorial' | 'github' | 'reference';
		class?: string;
	}
	
	let { type, class: className = '' }: Props = $props();
	
	// Use Tailwind utilities only, no custom classes
	const typeClasses = {
		official: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
		api: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
		tutorial: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
		github: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
		reference: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
	};
	
	const typeLabels = {
		official: 'Official',
		api: 'API',
		tutorial: 'Tutorial',
		github: 'GitHub',
		reference: 'Reference'
	};
</script>

<span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeClasses[type]} ${className}`}>
	{typeLabels[type]}
</span>