<script lang="ts" module>
	import type { Component } from 'svelte';

	export interface Primary {
		label: string;
		icon?: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		onclick: () => void;
		disabled?: boolean;
		loading?: boolean;
		/** `data-testid` of the button (scenarios and tests find it by this) */
		testid?: string;
	}
</script>

<script lang="ts">
	// THE create-action of a page — one rule for every screen: an orange button from 768 px, the floating button (FAB) in the corner on a phone.
	import { FloatingActionButton } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import Btn from './Btn.svelte';

	let { primary }: { primary: Primary } = $props();

	const bp = useBreakpoint();
	const PrimaryIcon = $derived(primary.icon ?? AddLarge);
</script>

{#snippet fabIcon()}<PrimaryIcon />{/snippet}

{#if bp.isMobile}
	<FloatingActionButton iconPrefix={fabIcon} aria-label={primary.label} title={primary.label} disabled={primary.disabled} onclick={primary.onclick} data-testid={primary.testid ?? 'primary-action'} />
{:else}
	<Btn label={primary.label} icon={primary.icon ?? AddLarge} onclick={primary.onclick} disabled={primary.disabled} loading={primary.loading} data-testid={primary.testid ?? 'primary-action'} />
{/if}
