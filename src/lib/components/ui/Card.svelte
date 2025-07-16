<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	
	interface Props extends HTMLAttributes<HTMLDivElement> {
		hover?: boolean;
	}
	
	let {
		hover = false,
		class: className = '',
		children,
		...restProps
	}: Props = $props();
	
	let cardClasses = $derived(`card ${hover ? 'card-hover' : ''} ${className}`);
</script>

<div class={cardClasses} {...restProps}>
	{@render children?.()}
</div>