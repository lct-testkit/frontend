<script lang="ts">
	// An explanation that slides out over an element while the pointer rests on it: the design system's Tooltip in our terms, ONE way to do it for the whole product
	// (a status chip, a badge, an abbreviation, an icon without a caption). `title` is the bold first line (what it is called), `text` is what it means.
	// The DS hides the trigger from assistive technology (`aria-hidden`) and opens on hover only, so: give the trigger its meaning for a screen reader yourself
	// (StatusChip does it with a `sr-only` line) and never hide the only copy of important information in a tip.
	// Three ways to open it: the pointer resting on the element, keyboard focus (the element is a tab stop; Esc closes it) and a tap on a phone (the touch browser sends the
	// mouse events, the tap does not reach the card or row under it, a tap elsewhere closes the tip). The DS opens only on hover, so the tip is driven from here (`isOpened`).
	import type { Snippet } from 'svelte';
	import { Tooltip } from '@lct-testkit/rt-ui';

	interface Props {
		/** what it means: one or two short sentences */
		text: string;
		/** bold first line */
		title?: string;
		/** where it opens (`auto` picks the side with room) */
		placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
		/** the element the tip belongs to */
		children: Snippet;
		class?: string;
	}

	let { text, title, placement = 'auto', children, class: className = '' }: Props = $props();

	let hover = $state(false);
	let focus = $state(false);
	const open = $derived(hover || focus);
</script>

<!-- the wrapper takes the keyboard focus (the DS trigger inside is aria-hidden and cannot); it is named by the tip itself -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<span
	class={['inline-flex max-w-full min-w-0 rounded-sm', className]}
	tabindex="0"
	role="note"
	aria-label={title ? `${title}. ${text}` : text}
	onfocusin={(e) => (focus = (e.target as HTMLElement).matches(':focus-visible'))}
	onfocusout={() => (focus = false)}
	onclick={(e) => {
		// a finger: the tap is for the explanation, not for the card or row that the chip sits in
		if (window.matchMedia('(pointer: coarse)').matches) {
			e.stopPropagation();
			e.preventDefault();
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) {
			focus = false;
			hover = false;
		}
	}}
>
	<Tooltip
		{title}
		subtitle={text}
		{placement}
		closeButton={false}
		isOpened={open}
		onOpen={() => (hover = true)}
		onClose={() => (hover = false)}
		tooltipClassName="rt-tip"
		class="inline-flex w-auto! max-w-full min-w-0 [&>:first-child]:w-auto!"
	>
		{@render children()}
	</Tooltip>
</span>
