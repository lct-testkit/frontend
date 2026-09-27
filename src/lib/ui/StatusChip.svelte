<script lang="ts">
	// Status pill with a colour dot: the design system's Badge in its calm `secondary` variant (the `primary` one is a solid loud fill).
	// `tone` = a design-system scheme; `color` = any CSS colour for the dot (workflow statuses carry their own hex).
	// `hint` = what the status means, in plain words: it slides out over the pill (Tip) and a screen reader reads it after the label.
	import { Badge } from '@lct-testkit/rt-ui';
	import Tip from './Tip.svelte';

	type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

	interface Props {
		label: string;
		tone?: Tone;
		/** overrides the dot colour: `#5b8def`, `var(--atmr-info-default)` */
		color?: string | null;
		/** the native tooltip; prefer `hint` */
		title?: string;
		/** what the status means (one or two short sentences): a tooltip over the pill */
		hint?: string;
	}

	let { label, tone = 'neutral', color = null, title, hint }: Props = $props();

	// Badge has no brand-orange scheme: an accent pill (e.g. the decision maker) uses the informational one
	const scheme = $derived(tone === 'accent' ? 'info' : tone);
	// one size, the DS table size (22 px, 12 px text): a smaller pill (2xs) read as noise next to 14 px table text
	const badgeSize = 's';
</script>

{#snippet pill(nativeTitle: string | undefined)}
	{#if color}
		<Badge {label} title={nativeTitle} dot colorScheme="neutral" size={badgeSize} variant="secondary" class="max-w-full">
			{#snippet dotSlot()}<span class="size-2 flex-none rounded-full" style:background={color}></span>{/snippet}
		</Badge>
	{:else}
		<Badge {label} title={nativeTitle} dot colorScheme={scheme} size={badgeSize} variant="secondary" class="max-w-full" />
	{/if}
{/snippet}

{#if hint}
	<!-- the DS tooltip hides its trigger from screen readers: the label and the meaning are given as text -->
	<span class="inline-flex max-w-full min-w-0">
		<Tip title={label} text={hint}>{@render pill(undefined)}</Tip>
		<span class="sr-only">{label}. {hint}</span>
	</span>
{:else}
	{@render pill(title)}
{/if}
