<script lang="ts" module>
	export type KeyValueLayout = 'stacked' | 'inline';
	export const KEY_VALUE = Symbol('key-value-layout');
</script>

<script lang="ts">
	// The container of `KeyValue` pairs. One block for every «ключ — значение» in the product (card fields, profile, entity data).
	//  stacked (default): the label above the value, in 1–3 columns — the DS card style (rt-ui/examples/crm → OrganizationCard).
	//  inline: label and value in two aligned columns, on ONE BASELINE (`align-items: baseline`; rows are subgrids of one grid, so every
	//  label column has the same width and every value starts at the same x). A phone gets the stacked form.
	import { setContext, type Snippet } from 'svelte';

	interface Props {
		layout?: KeyValueLayout;
		/** stacked: how many columns on a wide screen (fewer on narrower ones) */
		columns?: 1 | 2 | 3;
		children?: Snippet;
		class?: string;
	}

	let { layout = 'stacked', columns = 2, children, class: className = '' }: Props = $props();

	setContext(KEY_VALUE, () => layout);

	const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2 max-md:grid-cols-1', 3: 'grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1' } as const;
</script>

<dl class={['m-0 grid min-w-0', layout === 'inline' ? 'grid-cols-[minmax(7rem,13rem)_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:grid-cols-1 max-md:gap-y-4' : ['gap-x-6 gap-y-4', COLS[columns]], className]}>
	{@render children?.()}
</dl>
