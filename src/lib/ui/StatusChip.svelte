<script lang="ts">
	// Status pill with a colour dot: the design system's Badge in its calm `secondary` variant (the `primary` one is a solid loud fill).
	// `tone` = a design-system scheme; `color` = any CSS colour for the dot (workflow statuses carry their own hex).
	import { Badge } from '@lct-testkit/rt-ui';

	type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

	interface Props {
		label: string;
		tone?: Tone;
		/** overrides the dot colour: `#5b8def`, `var(--atmr-info-default)` */
		color?: string | null;
		title?: string;
	}

	let { label, tone = 'neutral', color = null, title }: Props = $props();

	// Badge has no brand-orange scheme: an accent pill (e.g. the decision maker) uses the informational one
	const scheme = $derived(tone === 'accent' ? 'info' : tone);
	// one size, the DS table size (22 px, 12 px text): a smaller pill (2xs) read as noise next to 14 px table text
	const badgeSize = 's';
</script>

{#if color}
	<Badge {label} {title} dot colorScheme="neutral" size={badgeSize} variant="secondary" class="max-w-full">
		{#snippet dotSlot()}<span class="size-2 flex-none rounded-full" style:background={color}></span>{/snippet}
	</Badge>
{:else}
	<Badge {label} {title} dot colorScheme={scheme} size={badgeSize} variant="secondary" class="max-w-full" />
{/if}
