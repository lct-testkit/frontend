<script lang="ts">
	// A wrapper without markup: everything inside (a Tip on a status chip) stops being a tab stop of its own — the row or the card is the stop.
	import { setContext, type Snippet } from 'svelte';
	import { NO_TAB_STOPS } from './no-tab-stops';

	let { children }: { children?: Snippet } = $props();
	setContext(NO_TAB_STOPS, true);
</script>

{@render children?.()}
