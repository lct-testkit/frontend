<script lang="ts">
	// Pick a colleague: typeahead over the staff directory (server-side search, 250 ms debounce).
	//   <UserPicker label="Ответственный" value={ownerId} roles={['KAM','HEAD']} onChange={(id, person) => (ownerId = id)} />
	import { untrack } from 'svelte';
	import { Select } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { people, type Person } from '$lib/api/people.svelte';
	import { ROLE_LABEL } from '$lib/auth/session.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { inFilterRow } from './filter-row';

	interface Props {
		value?: string | null;
		onChange: (id: string | null, person?: Person) => void;
		label?: string;
		placeholder?: string;
		roles?: string[];
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		clearable?: boolean;
		size?: 's' | 'm' | 'l';
		/** ids that must not be offered (e.g. the person being replaced) */
		exclude?: string[];
		/** the list opens at once (the picker appears because the person asked for it) */
		defaultOpened?: boolean;
		/** a search text that comes from outside (the name typed after «@» in a comment): the list is filtered by it */
		query?: string;
		/** where the list opens (`top` keeps a field below the picker visible) */
		placement?: 'bottom' | 'top';
	}

	let { value = null, onChange, label, placeholder = 'Начните вводить имя', roles, error, hint, disabled = false, required = false, clearable = true, size, exclude = [], defaultOpened = false, query, placement = 'bottom' }: Props = $props();

	const bp = useBreakpoint();

	// in the one-line filter row a field has no caption above it: the label is its placeholder
	const bare = inFilterRow();
	let found = $state<Person[]>([]);
	let loading = $state(false);

	const items = $derived.by(() => {
		const list = found.filter((p) => !exclude.includes(p.id));
		const current = value ? people.get(value) : null;
		if (current && !list.some((p) => p.id === current.id)) list.unshift(current);
		return list.map((p) => ({ key: p.id, value: p.display_name || p.full_name, hint: ROLE_LABEL[p.role] ?? p.role }));
	});

	async function run(q: string) {
		loading = true;
		try {
			found = await people.search(q, roles);
		} catch {
			found = [];
		} finally {
			loading = false;
		}
	}
	const search = debounce((q: string) => void run(q), 250);

	$effect(() => {
		if (value) people.ensure([value]);
	});
	$effect(() => {
		untrack(() => void run(''));
	});
	$effect(() => {
		if (query !== undefined) search(query);
	});

	function pick(key: string | number) {
		const id = key === '' || key === null ? null : String(key);
		onChange(id, id ? (people.get(id) ?? undefined) : undefined);
	}
</script>

<Select
	label={bare ? undefined : label}
	placeholder={bare ? (label ?? placeholder) : placeholder}
	aria-label={bare ? label : undefined}
	title={bare ? label : undefined}
	size={size ?? (bp.isMobile ? 'l' : 'm')}
	{error}
	{hint}
	{disabled}
	{required}
	{clearable}
	{items}
	{defaultOpened}
	value={value ?? null}
	{placement}
	emptyText={loading ? 'Поиск…' : 'Никого не найдено'}
	autocomplete={{ enabled: true, filterOptions: (_text, options) => options, onChange: (text) => search(text) }}
	onChange={pick}
	onClear={() => onChange(null)}
/>
