<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	
	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
	}
	
	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		class: className = '',
		children,
		...restProps
	}: Props = $props();
	
	const variantClasses = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		ghost: 'btn-ghost',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
	};
	
	const sizeClasses = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};
	
	let buttonClasses = $derived(`btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`);
</script>

<button
	class={buttonClasses}
	disabled={disabled || loading}
	{...restProps}
>
	{#if loading}
		<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{/if}
	{@render children?.()}
</button>