<script lang="ts">
	// One «ключ — значение» pair inside a `KeyValueList`. An empty value is «—», never a blank. Long values wrap (`break-words`), they never
	// push the layout. Scale: label 12/16 muted above the value 16/24 (stacked) or both 16/24 (inline) — one scale for the whole product.
	import { getContext, type Snippet } from 'svelte';
	import { KEY_VALUE, type KeyValueLayout } from './KeyValueList.svelte';

	interface Props {
		label: string;
		/** plain text value; use children for markup */
		value?: string | number | null;
		children?: Snippet;
		class?: string;
	}

	let { label, value, children, class: className = '' }: Props = $props();

	const layout = (getContext<(() => KeyValueLayout) | undefined>(KEY_VALUE) ?? (() => 'stacked' as const))();
	const empty = $derived(!children && (value === null || value === undefined || value === ''));
</script>

<div class={['min-w-0', layout === 'inline' ? 'col-span-full grid grid-cols-subgrid items-baseline max-md:grid-cols-1 max-md:gap-1' : 'flex flex-col gap-1', className]}>
	<dt class={layout === 'inline' ? 't-row text-muted max-md:t-desc-l' : 't-desc-l text-muted'}>{label}</dt>
	<dd class="t-row m-0 min-w-0 break-words">
		{#if children}{@render children()}{:else if empty}<span class="text-soft">—</span>{:else}{value}{/if}
	</dd>
</div>
