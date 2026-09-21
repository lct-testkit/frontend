<script lang="ts">
	// A list of rows on one surface (tasks, notifications, recent, history): the rows separated by hairlines inside a bordered card.
	// Optional header — a title with the count of rows («Просрочено · 5»), the danger tone for what needs attention.
	// The DS `ListItem` has no layout outside its side menu, so the rows are `ListRow`s.
	import type { Snippet } from 'svelte';
	import { Counter } from '@lct-testkit/rt-ui';

	interface Props {
		title?: string;
		count?: number;
		/** red title: overdue, breached */
		danger?: boolean;
		/** a link or icon button at the right of the header */
		action?: Snippet;
		children?: Snippet;
		label?: string;
	}

	let { title, count, danger = false, action, children, label }: Props = $props();
</script>

<section class="flex min-w-0 flex-col gap-2" aria-label={label ?? title}>
	{#if title || action}
		<header class="flex min-h-8 items-center gap-2">
			{#if title}<h2 class={['t-h4', danger && 'text-danger']}>{title}</h2>{/if}
			{#if count !== undefined}<Counter size="xs" variant="ghost" colorScheme={danger ? 'accent' : 'neutral'}>{count}</Counter>{/if}
			{#if action}<div class="ml-auto flex items-center gap-2">{@render action()}</div>{/if}
		</header>
	{/if}
	<ul class="m-0 flex min-w-0 list-none flex-col overflow-hidden rounded-lg border border-line bg-surface p-0">{@render children?.()}</ul>
</section>
