<script lang="ts">
	// Product mark as in the design system's CRM example: the Rostelecom logo (32 px) + name and a one-line description.
	//   <Brand />           logo + «RTK School» / «CRM по работе с вузами»
	//   <Brand compact />   logo only (collapsed menu)
	//   <Brand short />     logo + name (phone top bar); `logoOnNarrow`: the name goes away below 380 px (a 360 px top bar has no room for it)
	//   <Brand size="l" onDark />   big, white text, for the coloured login panel
	import { Typography } from '@lct-testkit/rt-ui';

	interface Props {
		compact?: boolean;
		short?: boolean;
		size?: 'm' | 'l';
		onDark?: boolean;
		logoOnNarrow?: boolean;
	}

	let { compact = false, short = false, size = 'm', onDark = false, logoOnNarrow = false }: Props = $props();
	const px = $derived(size === 'l' ? 48 : 32);
</script>

<span class="inline-flex min-w-0 items-center gap-2">
	<img src="/logo.svg" alt="" width={px} height={px} class={['flex-none', onDark && 'rounded-md bg-white']} />
	{#if !compact}
		<span class={['flex min-w-0 flex-col', logoOnNarrow && 'max-[380px]:hidden']}>
			<Typography as="span" variant={size === 'l' ? 'heading-h4' : 'body-s'} strong class={['whitespace-nowrap', onDark && 'text-white!']}>RTK School</Typography>
			{#if !short}<Typography as="span" variant="description-l" class={['whitespace-nowrap', onDark ? 'text-white/80!' : 'text-muted']}>CRM по работе с вузами</Typography>{/if}
		</span>
	{/if}
</span>
