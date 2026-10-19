<script lang="ts">
	// Content of a custom table cell. The DS zeroes the padding of cells that carry their own markup (`.atmr-tablegrid__cell--resetPadding`,
	// `!important`), and its own example puts the inset into the cell content (`.orgs__status`: 12 px, full height, centred) — this is that,
	// once, for every table. Text goes in as it is: it inherits the DS cell font (14/20). It is at least 40 px high — the height of the DS
	// checkbox cell — so a table with and a table without selection have the same rows. One line per cell: every row keeps one height.
	import type { Snippet } from 'svelte';
	import NoTabStops from './NoTabStops.svelte';

	interface Props {
		children?: Snippet;
		/** numbers and amounts */
		align?: 'left' | 'right';
		class?: string;
	}

	let { children, align = 'left', class: className = '' }: Props = $props();

	// A truncated text («Егорова Алина Романов…») says what it is on hover: the native tooltip with the full text is put on the element the pointer is over, when the text really is cut
	// and the element has no `title` of its own. Done once here, so every table of the product gets it and no cell has to remember.
	function showFull(event: PointerEvent) {
		const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('.truncate, [class*="line-clamp"]');
		if (!el || el.hasAttribute('title')) return;
		const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
		const text = el.textContent?.replace(/\s+/g, ' ').trim();
		if (cut && text) el.setAttribute('title', text);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class={['flex h-full min-h-10 min-w-0 items-center gap-2 px-[15px]', align === 'right' && 'justify-end text-right', className]} onpointerover={showFull}><NoTabStops>{@render children?.()}</NoTabStops></div>
