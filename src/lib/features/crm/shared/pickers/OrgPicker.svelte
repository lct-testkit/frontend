<script lang="ts">
	// Организация из тех, что видны пользователю (поиск по названию и ИНН на сервере).
	import { api, unwrap } from '$lib/api';
	import { orgCache, orgTitle } from '../entityCache.svelte';
	import RemotePick, { type RemoteItem } from '$lib/ui/fields/RemotePick.svelte';

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

	async function search(q: string): Promise<RemoteItem[]> {
		const page = await unwrap(api.GET('/api/organizations', { params: { query: { q: q.trim() || undefined, limit: 20 } } }));
		for (const org of page.items) orgCache.put(org);
		return page.items.map((o) => ({ key: o.id, value: orgTitle(o), hint: o.inn ?? undefined }));
	}
</script>

<RemotePick {value} {selected} {search} {label} {error} {hint} {disabled} {required} placeholder="Название или ИНН" emptyText="Организаций не найдено" onChange={(id) => onChange(id)} />
