<script lang="ts">
	// One row of a `RowList`:  [prefix]  title / description  [suffix].  At least 56 px high, the same in every list.
	// A clickable row has ONE focusable element — the title (a button, or a link when `href` is given) — whose ::after covers the whole row,
	// so the row is clickable everywhere, reachable by keyboard, and other controls in it (a checkbox, a link in the description) still work:
	// they sit above the cover (`relative z-10`) — put `class="relative z-10"` on such controls.
	import type { Snippet } from 'svelte';

	interface Props {
		/** the one line of the row: the name */
		title: string;
		/** a struck-out grey title: done, cancelled */
		muted?: boolean;
		/** the small grey line under the title (a snippet: dates, names, links) */
		description?: Snippet;
		/** a control or an icon at the start: a checkbox, an avatar */
		prefix?: Snippet;
		/** a chip, a date, buttons at the end */
		suffix?: Snippet;
		onclick?: () => void;
		href?: string;
		/** the row is the current one (a list next to a detail) */
		selected?: boolean;
		/** unread: a bolder title and a dot */
		unread?: boolean;
	}

	let { title, muted = false, description, prefix, suffix, onclick, href, selected = false, unread = false }: Props = $props();

	const base = $derived([unread ? 't-row-strong' : 't-row', 'max-w-full min-w-0 text-left break-words text-fg', muted && 'text-muted line-through']);
	// the cover of the whole row: only the focusable title has it
	const cover = 'after:absolute after:inset-0 after:content-[""]';
</script>

<li class={['relative flex min-h-14 items-center gap-3 border-b border-line px-[15px] py-2 last:border-b-0', (onclick || href) && 'transition-colors hover:bg-surface-2', selected && 'bg-accent-soft']}>
	{#if prefix}<div class="relative z-10 flex flex-none items-center">{@render prefix()}</div>{/if}

	<div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
		{#if href}
			<a {href} class={[base, cover]} aria-current={selected || undefined}>{title}</a>
		{:else if onclick}
			<button type="button" class={[base, cover, 'cursor-pointer border-0 bg-transparent p-0']} {onclick} aria-current={selected || undefined}>{title}</button>
		{:else}
			<span class={base}>{title}</span>
		{/if}
		{#if description}<div class="t-desc-l flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-muted">{@render description()}</div>{/if}
	</div>

	{#if unread}<span class="size-2 flex-none rounded-full bg-accent" aria-hidden="true"></span>{/if}
	{#if suffix}<div class="relative z-10 flex flex-none items-center gap-2">{@render suffix()}</div>{/if}
</li>
