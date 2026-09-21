<script lang="ts">
	// Content of a custom table cell. The DS zeroes the padding of cells that carry their own markup (`.atmr-tablegrid__cell--resetPadding`,
	// `!important`), and its own example puts the inset into the cell content (`.orgs__status`: 12 px, full height, centred) — this is that,
	// once, for every table. Text goes in as it is: it inherits the DS cell font (14/20). It is at least 40 px high — the height of the DS
	// checkbox cell — so a table with and a table without selection have the same rows. One line per cell: every row keeps one height.
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		/** numbers and amounts */
		align?: 'left' | 'right';
		class?: string;
	}

	let { children, align = 'left', class: className = '' }: Props = $props();
</script>

<div class={['flex h-full min-h-10 min-w-0 items-center gap-2 px-[15px]', align === 'right' && 'justify-end text-right', className]}>{@render children?.()}</div>
