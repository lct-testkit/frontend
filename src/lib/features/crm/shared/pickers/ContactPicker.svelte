<script lang="ts">
	// Контакт (поиск по ФИО на сервере); можно ограничить организацией.
	import { api, unwrap } from '$lib/api';
	import { contactCache, contactFullName } from '../entityCache.svelte';
	import RemotePick, { type RemoteItem } from '$lib/ui/fields/RemotePick.svelte';

	interface Props {
		value?: string | null;
		organizationId?: string | null;
		label?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		onChange: (id: string | null) => void;
	}

	let { value = null, organizationId = null, label = 'Контакт', error, hint, disabled = false, onChange }: Props = $props();

	$effect(() => {
		if (value) contactCache.ensure([value]);
	});

	const selected = $derived.by<RemoteItem | null>(() => {
		const contact = value ? contactCache.get(value) : null;
		return contact ? { key: contact.id, value: contactFullName(contact), hint: contact.position ?? undefined } : null;
	});

	async function search(q: string): Promise<RemoteItem[]> {
		const page = await unwrap(api.GET('/api/contacts', { params: { query: { q: q.trim() || undefined, organization_id: organizationId ?? undefined, limit: 20 } } }));
		for (const contact of page.items) contactCache.put(contact);
		return page.items.map((c) => ({ key: c.id, value: contactFullName(c), hint: c.position ?? undefined }));
	}
</script>

<RemotePick {value} {selected} {search} refreshKey={organizationId} {label} {error} {hint} {disabled} placeholder="Фамилия или имя" emptyText="Контактов не найдено" onChange={(id) => onChange(id)} />
