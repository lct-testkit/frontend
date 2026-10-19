<script lang="ts">
	// Выбор из большого списка с серверным поиском (организации, контакты): ввод → запрос с задержкой → список.
	// `selected` — уже выбранный элемент (чтобы название было видно, пока список не загружен).
	import { untrack } from 'svelte';
	import { Select } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { inFilterRow } from '$lib/ui/filter-row';
	import { debounce } from '$lib/utils/debounce';
	import { useFreshError } from './fresh-error.svelte';

	export interface RemoteItem {
		key: string;
		value: string;
		hint?: string;
		[extra: string]: unknown;
	}

	interface Props {
		value?: string | null;
		search: (q: string) => Promise<RemoteItem[]>;
		selected?: RemoteItem | null;
		/** при смене значения список запрашивается заново (например, сменилась организация контакта) */
		refreshKey?: unknown;
		label?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		clearable?: boolean;
		emptyText?: string;
		/** не запрашивать список при показе поля — только при открытии */
		lazy?: boolean;
		onChange: (id: string | null, item?: RemoteItem) => void;
	}

	let { value = null, search, selected = null, refreshKey, label, placeholder = 'Начните вводить', error, hint, disabled = false, required = false, clearable = true, emptyText = 'Ничего не найдено', lazy = false, onChange }: Props = $props();

	// the message of a mistake goes away when the field is edited (see fresh-error)
	const fresh = useFreshError(() => error, () => value);

	const bp = useBreakpoint();
	// in the one-line filter row a field has no caption above it: the label is its placeholder
	const bare = inFilterRow();
	let found = $state<RemoteItem[]>([]);
	let loading = $state(false);
	let seq = 0;

	const items = $derived.by(() => {
		const list = [...found];
		if (selected && !list.some((i) => i.key === selected.key)) list.unshift(selected);
		return list;
	});

	async function run(q: string) {
		const mine = ++seq;
		loading = true;
		try {
			const next = await search(q);
			if (mine === seq) found = next;
		} catch {
			if (mine === seq) found = [];
		} finally {
			if (mine === seq) loading = false;
		}
	}
	const later = debounce((q: string) => void run(q), 250);

	let loadedOnce = false;
	$effect(() => {
		void refreshKey;
		if (lazy) {
			loadedOnce = false;
			return;
		}
		untrack(() => void run(''));
	});
	function onOpen() {
		if (!lazy || loadedOnce) return;
		loadedOnce = true;
		void run('');
	}
</script>

<Select
	class="w-full"
	size={bp.isMobile ? 'l' : 'm'}
	label={bare ? undefined : label}
	placeholder={bare ? (label ?? placeholder) : placeholder}
	aria-label={bare ? label : undefined}
	title={bare ? label : undefined}
	error={fresh.error}
	{hint}
	{disabled}
	{required}
	{clearable}
	{items}
	value={value ?? ''}
	placement="bottom"
	emptyText={loading ? 'Поиск…' : emptyText}
	autocomplete={{ enabled: true, filterOptions: (_text, options) => options, onChange: (text) => later(text) }}
	onChange={(key: string | number) => {
		const id = key === '' || key === null ? null : String(key);
		onChange(id, id ? items.find((i) => i.key === id) : undefined);
	}}
	onOpen={onOpen}
	onClear={() => onChange(null)}
/>
