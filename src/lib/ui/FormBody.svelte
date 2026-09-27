<script lang="ts">
	// THE width rule for fields that stand on a page or in a wide card (a wizard step, a settings block) instead of in a drawer/dialog, which have their own fixed width:
	// a field never gets wider than ~576 px — beyond that the eye loses the line and a short value floats in a long box (16" screens, 2200 px). Tables, cards and
	// notices stay full width; only the fields go in here. Same 16 px gap as FormDrawer. `wide` (720 px) is for a text area with a long text.
	import type { Snippet } from 'svelte';

	let { children, wide = false, class: className = '' }: { children?: Snippet; wide?: boolean; class?: string } = $props();
</script>

<div class={['flex w-full min-w-0 flex-col gap-4', wide ? 'max-w-3xl' : 'max-w-xl', className]}>{@render children?.()}</div>
