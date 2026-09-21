<script lang="ts">
	// Short related fields side by side (amount + priority, from + to, first name + last name): 2 (or 3) equal columns with a 12 px gap on a desktop, one column
	// on a phone. A field that needs the whole width (a name, an address, a comment) stands outside a row.
	import type { Snippet } from 'svelte';

	let { children, cols = 2, class: className = '' }: { children?: Snippet; cols?: 2 | 3; class?: string } = $props();
</script>

<div class={['grid items-start gap-x-3 gap-y-4 max-md:grid-cols-1', cols === 3 ? 'grid-cols-3' : 'grid-cols-2', className]}>{@render children?.()}</div>
