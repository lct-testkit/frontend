<script lang="ts">
	// "Nothing here": one line + (optionally) the one action that fixes it.
	import type { Component, Snippet } from 'svelte';

	interface Props {
		title: string;
		/** one short sentence, only when the title alone is not enough */
		hint?: string;
		icon?: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		action?: Snippet;
		compact?: boolean;
	}

	let { title, hint, icon, action, compact = false }: Props = $props();
</script>

<div class={['flex flex-col items-center justify-center gap-2 text-center text-muted', compact ? 'px-3 py-6' : 'px-4 py-12']} role="status">
	{#if icon}
		{@const Icon = icon}
		<span class="inline-flex size-14 items-center justify-center rounded-full bg-surface-3 [&_svg]:size-7 [&_svg]:fill-soft"><Icon /></span>
	{/if}
	<p class="t-body-l-strong text-fg">{title}</p>
	{#if hint}<p class="t-body-m max-w-105 text-muted">{hint}</p>{/if}
	{#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
