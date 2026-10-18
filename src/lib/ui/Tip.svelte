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
	// Подсказка DS — отдельный элемент в <body>, и он остаётся там скрытым у КАЖДОГО чипа. У чипов в прокручиваемых лентах (доска сделок)
	// такие скрытые подсказки торчали справа от экрана и растягивали страницу: на телефоне обрезало верхнюю панель.
	// Поэтому DS-подсказка создаётся только при первом наведении или фокусе, а до этого чип рисуется без неё.
	let armed = $state(false);
	let over = false;
	/** DS-подсказка только что создана: открываем её на следующем кадре (создание сразу открытой DS воспринимает как закрытие) */
	function arm(then: () => void) {
		if (armed) return then();
		armed = true;
		setTimeout(then, 30);
	}
</script>

<!-- the wrapper takes the keyboard focus (the DS trigger inside is aria-hidden and cannot); it is named by the tip itself -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<span
	class={['inline-flex max-w-full min-w-0 rounded-sm', className]}
	tabindex="0"
	role="note"
	aria-label={title ? `${title}. ${text}` : text}
	onmouseenter={() => {
		over = true;
		arm(() => (hover = over));
	}}
	onmouseleave={() => {
		over = false;
		hover = false;
	}}
	onfocusin={(e) => {
		const visible = (e.target as HTMLElement).matches(':focus-visible');
		if (visible) arm(() => (focus = true));
	}}
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
	{#if armed}
	<Tooltip
		{title}
		subtitle={text}
		{placement}
		closeButton={false}
		isOpened={open}
		onOpen={() => (hover = true)}
		onClose={() => (hover = false)}
		tooltipClassName="rt-tip"
		class="inline-flex w-auto! max-w-full min-w-0 [&>:first-child]:w-auto! [&>:first-child]:max-w-full [&>:first-child]:min-w-0"
	>
		{@render children()}
	</Tooltip>
	{:else}
		<span class="inline-flex w-auto max-w-full min-w-0"><span class="flex max-w-full min-w-0">{@render children()}</span></span>
	{/if}
</span>
