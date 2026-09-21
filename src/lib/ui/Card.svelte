<script lang="ts">
	// Surface block: optional title row (title + `action` snippet, usually one link or icon button) and a body.
	// `flush` = body without padding (lists that run edge to edge).
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		action?: Snippet;
		children?: Snippet;
		flush?: boolean;
		class?: string;
	}

	let { title, action, children, flush = false, class: className = '' }: Props = $props();
</script>

<section class={['flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface', className]}>
	{#if title || action}
		<header class="flex min-h-12 items-center justify-between gap-3 px-[15px] pt-3 pb-1">
			{#if title}<h2 class="t-h4">{title}</h2>{/if}
			{#if action}<div class="ml-auto flex items-center gap-2">{@render action()}</div>{/if}
		</header>
	{/if}
	<div class={['min-w-0 flex-1', flush ? 'pb-1' : 'p-[15px] pt-2']}>{@render children?.()}</div>
</section>
