<script lang="ts">
	// Icon-only button: always has an accessible name (aria-label + title). The default look is a quiet ghost button.
	import type { Component } from 'svelte';
	import { IconButton } from '@lct-testkit/rt-ui';

	interface Props {
		icon: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		/** what it does — used as aria-label and native tooltip */
		label: string;
		onclick?: (event: MouseEvent) => void;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
		colorScheme?: 'accent' | 'neutral';
		size?: 's' | 'm' | 'l' | 'xl';
		disabled?: boolean;
		danger?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let { icon, label, onclick, variant = 'ghost', colorScheme = 'neutral', size = 'm', disabled = false, danger = false, class: className = '', ...rest }: Props = $props();
</script>

{#snippet ic()}
	{@const Icon = icon}
	<Icon />
{/snippet}

<IconButton
	{variant}
	{colorScheme}
	{size}
	{disabled}
	{onclick}
	icon={ic}
	aria-label={label}
	title={label}
	class={['pointer-coarse:min-h-11 pointer-coarse:min-w-11', danger && 'text-danger [&_svg]:fill-danger', className]}
	{...rest}
/>
