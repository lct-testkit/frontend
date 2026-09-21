<script lang="ts">
	// Регионы РФ: справочник только для чтения (бэкенд не даёт его менять) — поиск по названию, округу и коду на клиенте.
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { type Col, TableCell } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import type { Region } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import CatalogList from './CatalogList.svelte';
	import CatalogPage from './CatalogPage.svelte';

	const list = createResource((signal) => unwrap(api.GET('/api/regions', { signal })).then((r) => r.items));
	onMount(() => void list.reload());

	const q = $derived(readQuery('q').trim().toLowerCase());
	const rows = $derived(
		(list.data ?? [])
			.filter((r) => !q || `${r.name} ${r.federal_district ?? ''} ${r.code}`.toLowerCase().includes(q))
			.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
	);

	const columns: Col<Region>[] = [
		{ key: 'code', title: 'Код', render: codeCell },
		{ key: 'name', title: 'Регион', width: 'minmax(220px, 2fr)', render: nameCell },
		{ key: 'federal_district', title: 'Округ', width: 'minmax(160px, 1fr)', drop: 2, render: districtCell },
		{ key: 'timezone', title: 'Часовой пояс', drop: 1, render: tzCell }
	];
</script>

{#snippet codeCell(r: Region)}<TableCell><span class="t-body-s font-mono text-muted">{r.code}</span></TableCell>{/snippet}
{#snippet nameCell(r: Region)}<TableCell><span class="t-body-m-strong">{r.name}</span></TableCell>{/snippet}
{#snippet districtCell(r: Region)}<TableCell><span class="t-body-s text-muted">{r.federal_district ?? '—'}</span></TableCell>{/snippet}
{#snippet tzCell(r: Region)}<TableCell><span class="t-body-s text-muted">{r.timezone ?? '—'}</span></TableCell>{/snippet}

{#snippet card(r: Region)}
	<div class="flex min-w-0 flex-col gap-0.5">
		<span class="t-body-m-strong wrap-anywhere">{r.name}</span>
		<span class="t-desc-l text-muted"><span class="font-mono">{r.code}</span>{r.federal_district ? ` · ${r.federal_district}` : ''}</span>
	</div>
{/snippet}

<CatalogPage active="regions">
	{#snippet toolbar()}
		<FilterBar search={readQuery('q')} placeholder="Название, округ или код" onSearch={(v) => setQuery({ q: v })} />
	{/snippet}
	<CatalogList {rows} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} filtered={Boolean(q)} emptyText="Регионов нет" ariaLabel="Регионы" />
</CatalogPage>
