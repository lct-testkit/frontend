<script lang="ts">
	// The choice of SEVERAL values from a list: `bind:value` — an array of keys; the chosen ones stand as tags. A DS `m` field on a desktop, `l` on a phone.
	import { Multiselect } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import type { PickItem } from './Pick.svelte';

	interface Props {
		value?: string[];
		items: readonly PickItem[];
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		search?: boolean;
		emptyText?: string;
		class?: string;
		onChange?: (value: string[]) => void;
	}

	let { value = $bindable([]), items, label, placeholder, error, hint, disabled = false, required = false, search = true, emptyText = 'Ничего не найдено', class: className = '', onChange }: Props = $props();

	const bp = useBreakpoint();
	// the DS keeps the search input in the field while a `placeholder` is set — with tags chosen it wraps to a second row, so the placeholder goes with the last tag
	const menu = $derived(items.map((i) => ({ key: i.key, value: i.value, hint: i.hint, disabled: i.disabled })));
	const selected = $derived(menu.filter((i) => value.includes(i.key)));
</script>

<Multiselect
	class={['w-full', className]}
	size={bp.isMobile ? 'l' : 'm'}
	{label}
	placeholder={value.length ? undefined : placeholder}
	{error}
	hintPrefix={hint}
	{disabled}
	{required}
	{emptyText}
	autoHeight
	placement="bottom"
	items={menu}
	value={selected}
	autocomplete={{ enabled: search, clearSearchOnSelect: true }}
	onChange={(options: { key: string | number }[]) => {
		value = options.map((o) => String(o.key));
		onChange?.(value);
	}}
/>
