<script lang="ts">
	// Сделка из доступных пользователю (поиск по номеру и названию на сервере).
	import { api, unwrap } from '$lib/api';
	import { dealCache } from '../entityCache.svelte';
	import RemotePick, { type RemoteItem } from '$lib/ui/fields/RemotePick.svelte';

	interface Props {
		value?: string | null;
		label?: string;
		error?: string;
		disabled?: boolean;
		onChange: (id: string | null) => void;
	}

	let { value = null, label = 'Сделка', error, disabled = false, onChange }: Props = $props();

	$effect(() => {
		if (value) dealCache.ensure([value]);
	});

	const item = (d: { id: string; number: string; title: string }): RemoteItem => ({ key: d.id, value: `${d.number} · ${d.title}` });
	const selected = $derived.by<RemoteItem | null>(() => {
		const deal = value ? dealCache.get(value) : null;
		return deal ? item(deal) : null;
	});

	async function search(q: string): Promise<RemoteItem[]> {
		const page = await unwrap(api.GET('/api/deals', { params: { query: { q: q.trim() || undefined, limit: 20 } } }));
		for (const deal of page.items) dealCache.put(deal);
		return page.items.map(item);
	}
</script>

<RemotePick {value} {selected} {search} {label} {error} {disabled} placeholder="Номер или название" emptyText="Сделок не найдено" clearable={false} onChange={(id) => onChange(id)} />
