<script lang="ts">
	// Icon button of the top bar: the design system's `.atmr-top-menu__utilities-icon` (36 px, rounded, hover / active from its CSS).
	// It is a real <button> (the DS example uses a bare <div>): keyboard and screen readers work, the look is the DS's own.
	import type { Component, Snippet } from 'svelte';

	interface Props {
		icon?: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		/** what it does: aria-label and native tooltip */
		label: string;
		onclick?: (event: MouseEvent) => void;
		/** custom content instead of `icon` (the bell swaps two icons) */
		children?: Snippet;
		[key: string]: unknown;
	}

	let { icon, label, onclick, children, ...rest }: Props = $props();
</script>

<button type="button" class="atmr-top-menu__utilities-icon" aria-label={label} title={label} {onclick} {...rest}>
	{#if children}{@render children()}{:else if icon}{@const Icon = icon}<Icon />{/if}
</button>
