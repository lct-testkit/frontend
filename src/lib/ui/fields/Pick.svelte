<script lang="ts" module>
	export interface PickItem {
		key: string;
		value: string;
		hint?: string;
		disabled?: boolean;
		/** a group title (not selectable) */
		title?: boolean;
	}
</script>

<script lang="ts">
	// The choice of ONE value from a list: `value` is a key or null (`bind:value` or `value` + `onChange`). `search` turns the search on (long lists), `clearable`
	// lets the person clear the choice. A DS `m` field on a desktop, `l` on a phone (see TextField). In the one-line filter row the label is the placeholder.
	import { Select } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { inFilterRow } from '../filter-row';

	interface Props {
		value?: string | null;
		items: readonly PickItem[];
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		clearable?: boolean;
		search?: boolean;
		required?: boolean;
		emptyText?: string;
		size?: 's' | 'm' | 'l';
		class?: string;
		onChange?: (value: string | null) => void;
	}

	let {
		value = $bindable(null),
		items,
		label,
		placeholder,
		error,
		hint,
		disabled = false,
		clearable = false,
		search = false,
		required = false,
		emptyText = 'Ничего не найдено',
		size,
		class: className = '',
		onChange
	}: Props = $props();

	const bp = useBreakpoint();
	// in the one-line filter row a field has no caption above it: the label is its placeholder
	const bare = inFilterRow();
</script>

<Select
	class={['w-full', className]}
	size={size ?? (bp.isMobile ? 'l' : 'm')}
	label={bare ? undefined : label}
	placeholder={bare ? (label ?? placeholder) : placeholder}
	aria-label={bare ? label : undefined}
	title={bare ? label : undefined}
	{error}
	{hint}
	{disabled}
	{required}
	{clearable}
	{emptyText}
	deselectEnabled={clearable}
	value={value ?? ''}
	items={items.map((i) => ({ key: i.key, value: i.value, hint: i.hint, disabled: i.disabled, isTitle: i.title }))}
	autocomplete={{ enabled: search }}
	placement="bottom"
	onChange={(key: string | number) => {
		const next = key === '' || key === null || key === undefined ? null : String(key);
		if (next === null && !clearable) return;
		value = next;
		onChange?.(next);
	}}
	onClear={() => {
		value = null;
		onChange?.(null);
	}}
/>

<style>
	/* the DS list of a Select is below a Drawer / Modal (z-index 1000 against 1500): lift it above the windows */
	:global(body.rt-base) {
		--atmr-z-index-dropdown: 1650;
	}
</style>
