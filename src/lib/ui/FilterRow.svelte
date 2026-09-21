<script lang="ts">
	// Marks its children as fields of the one-line filter row (no DOM of its own): see filter-row.ts.
	import { setContext, type Snippet } from 'svelte';
	import { FILTER_ROW } from './filter-row';

	let { children }: { children?: Snippet } = $props();

	setContext(FILTER_ROW, true);
</script>

{@render children?.()}
