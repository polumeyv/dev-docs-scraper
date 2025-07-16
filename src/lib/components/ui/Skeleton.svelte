<script lang="ts">
	interface Props {
		class?: string;
		variant?: 'text' | 'circular' | 'rectangular';
		width?: string;
		height?: string;
	}
	
	let { 
		class: className = '', 
		variant = 'text',
		width,
		height
	}: Props = $props();
	
	const variantClasses = {
		text: 'rounded',
		circular: 'rounded-full',
		rectangular: 'rounded-md'
	};
	
	let style = $derived(`${width ? `width: ${width};` : ''} ${height ? `height: ${height};` : ''}`);
</script>

<div 
	class={`animate-pulse bg-neutral-200 dark:bg-neutral-700 ${variantClasses[variant]} ${className}`}
	{style}
	role="status"
	aria-label="Loading..."
>
	<span class="sr-only">Loading...</span>
</div>