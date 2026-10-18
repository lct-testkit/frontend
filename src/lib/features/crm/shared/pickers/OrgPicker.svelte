<script lang="ts">
	// Организация из тех, что видны пользователю (поиск по названию и ИНН на сервере).
	import { orgCache, orgTitle } from '../entityCache.svelte';
	import RemotePick, { type RemoteItem } from '$lib/ui/fields/RemotePick.svelte';
	import { searchOrganizations } from './orgSearch';

	interface Props {
		value?: string | null;
		label?: string;
		error?: string;
		hint?: string;
		required?: boolean;
		disabled?: boolean;
		onChange: (id: string | null) => void;
	}

	let { value = null, label = 'Организация', error, hint, disabled = false, required = false, onChange }: Props = $props();

	$effect(() => {
		if (value) orgCache.ensure([value]);
	});

	const selected = $derived.by<RemoteItem | null>(() => {
		const org = value ? orgCache.get(value) : null;
		return org ? { key: org.id, value: orgTitle(org), hint: org.inn ?? undefined } : null;
	});

</script>

<RemotePick {value} {selected} search={searchOrganizations} {label} {error} {hint} {disabled} {required} placeholder="Название или ИНН" emptyText="Организаций не найдено" onChange={(id) => onChange(id)} />
