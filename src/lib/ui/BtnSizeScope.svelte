<script lang="ts" module>
	export const BTN_SIZE = Symbol('btn-size');
</script>

<script lang="ts">
	// The size the buttons inside take when they name none: the footers of dialogs and panels set `auto` (m on a desktop, l — a touch target — on a phone), so a footer never
	// has to say it button by button.
	import { setContext, type Snippet } from 'svelte';

	let { size, children }: { size: 's' | 'm' | 'l' | 'xl' | 'auto'; children?: Snippet } = $props();

	// svelte-ignore state_referenced_locally
	setContext(BTN_SIZE, size);
</script>

{@render children?.()}
