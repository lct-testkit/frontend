<script lang="ts">
	// The surface of a wizard step: the content on top, under it — behind a hairline, like the footer of a dialog or a panel — the buttons of the step: the MAIN one first («Далее»,
	// «Применить»), the others after it, on the left. On a phone the buttons stand one under another, as wide as the card, the main one at the bottom (at the thumb), size l.
	import type { Snippet } from 'svelte';
	import BtnSizeScope from './BtnSizeScope.svelte';

	interface Props {
		children?: Snippet;
		/** the buttons of the step (`Btn`s; the size is set here) */
		actions?: Snippet;
		class?: string;
		[key: string]: unknown;
	}

	let { children, actions, class: className = '', ...rest }: Props = $props();
</script>

<section class={['flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface', className]} {...rest}>
	<div class="flex min-w-0 flex-col gap-4 p-[15px]">{@render children?.()}</div>
	{#if actions}
		<BtnSizeScope size="auto">
			<div class="flex flex-wrap items-center gap-3 border-t border-line px-[15px] py-3 max-md:flex-col-reverse max-md:items-stretch max-md:[&_button]:w-full">{@render actions()}</div>
		</BtnSizeScope>
	{/if}
</section>
