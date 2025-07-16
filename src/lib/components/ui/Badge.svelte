<script lang="ts">
	interface Props {
		type: 'official' | 'api' | 'tutorial' | 'github' | 'reference';
		class?: string;
	}
	
	let { type, class: className = '' }: Props = $props();
	
	const typeClasses = {
		official: 'badge-official',
		api: 'badge-api',
		tutorial: 'badge-tutorial',
		github: 'badge-github',
		reference: 'badge-reference'
	};
	
	const typeLabels = {
		official: 'Official',
		api: 'API',
		tutorial: 'Tutorial',
		github: 'GitHub',
		reference: 'Reference'
	};
</script>

<span class={`badge ${typeClasses[type]} ${className}`}>
	{typeLabels[type]}
</span>