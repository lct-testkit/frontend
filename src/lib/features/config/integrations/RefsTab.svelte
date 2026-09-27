<script lang="ts">
	// Связи записей CRM с внешними системами: какому идентификатору снаружи соответствует сделка, организация или контакт.
	import { untrack } from 'svelte';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { DateText, FilterBar, IconBtn, Notice, TableCell, type Col } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { INTEGRATION_SOURCES, SYNC_DIRECTIONS, labelOf } from '../labels';
	import type { ExternalRef } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import CatalogList from '../catalog/CatalogList.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { LIMITS } from './limits';

	const ENTITIES = [
		{ key: 'deal', value: 'Сделки', href: (id: string) => `/deals/${id}` },
		{ key: 'organization', value: 'Организации', href: (id: string) => `/organizations/${id}` },
		{ key: 'contact', value: 'Контакты', href: (id: string) => `/contacts/${id}` }
	];
	const source = $derived(readQuery('source') || null);
	const entity = $derived(readQuery('entity') || null);
	const limit = $derived(Number(readQuery('limit')) || 100);
	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/external-refs', { params: { query: { source_code: source, entity_type: entity, limit } }, signal })).then((r) => r as ExternalRef[]));
	$effect(() => {
		void [source, entity, limit];
		untrack(() => void list.reload());
	});

	const link = (r: ExternalRef) => ENTITIES.find((e) => e.key === r.entity_type)?.href(r.entity_id) ?? null;
	const entityName = (t: string) => ENTITIES.find((e) => e.key === t)?.value ?? t;

	const columns: Col<ExternalRef>[] = [
		{ key: 'entity', title: 'Запись CRM', width: 'minmax(180px, 1fr)', render: entityCell },
		{ key: 'source', title: 'Внешняя система', width: 'minmax(160px, 1fr)', render: sourceCell },
		{ key: 'version', title: 'Версия', align: 'right', drop: 2, render: versionCell },
		{ key: 'sync', title: 'Синхронизировано', drop: 1, render: syncCell }
	];
</script>

{#snippet entityCell(r: ExternalRef)}
	{@const href = link(r)}
	<TableCell>
		{#if href}<a class="t-body-m-strong" {href}>{entityName(r.entity_type)} · {r.entity_id.slice(-6)}</a>{:else}<span class="t-body-m-strong">{entityName(r.entity_type)} · {r.entity_id.slice(-6)}</span>{/if}
	</TableCell>
{/snippet}
{#snippet sourceCell(r: ExternalRef)}
	<TableCell>
		<span class="flex min-w-0 flex-col"><span class="t-body-m-strong">{labelOf(INTEGRATION_SOURCES, r.source_code)}</span><span class="t-desc-m font-mono text-soft wrap-anywhere">{r.external_id}</span></span>
	</TableCell>
{/snippet}
{#snippet versionCell(r: ExternalRef)}<TableCell align="right"><span class="t-body-s tabular-nums">{r.synced_version}</span></TableCell>{/snippet}
{#snippet syncCell(r: ExternalRef)}<TableCell><span class="t-body-s">{#if r.last_synced_at}<DateText value={r.last_synced_at} time />{:else}—{/if} <span class="text-soft">· {labelOf(SYNC_DIRECTIONS, r.sync_direction).toLowerCase()}</span></span></TableCell>{/snippet}

{#snippet card(r: ExternalRef)}
	{@const href = link(r)}
	<div class="flex min-w-0 flex-col gap-1">
		{#if href}<a class="t-body-m-strong" {href}>{entityName(r.entity_type)} · {r.entity_id.slice(-6)}</a>{:else}<span class="t-body-m-strong">{entityName(r.entity_type)} · {r.entity_id.slice(-6)}</span>{/if}
		<span class="t-desc-l text-muted">{labelOf(INTEGRATION_SOURCES, r.source_code)} · <span class="font-mono wrap-anywhere">{r.external_id}</span></span>
		<span class="t-desc-m text-soft">{#if r.last_synced_at}<DateText value={r.last_synced_at} time />{/if} · {labelOf(SYNC_DIRECTIONS, r.sync_direction).toLowerCase()}</span>
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Система" clearable placeholder="Любая" value={source} items={INTEGRATION_SOURCES.map((s) => ({ key: s.key, value: s.value }))} onChange={(v) => setQuery({ source: v })} />
	<Pick label="Запись" clearable placeholder="Любая" value={entity} items={ENTITIES.map((e) => ({ key: e.key, value: e.value }))} onChange={(v) => setQuery({ entity: v })} />
	<Pick label="Показывать" value={String(limit)} items={LIMITS.map((n) => ({ key: String(n), value: `Последние ${n}` }))} onChange={(v) => setQuery({ limit: v === '100' ? null : v })} />
{/snippet}
{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => list.reload()} />{/snippet}

<Notice class="shrink-0" tone="info">Соответствие записей CRM и внешних систем: какая сделка или организация какой записи там отвечает. Создаются автоматически при обмене.</Notice>
<FilterBar active={[source, entity].filter(Boolean).length} onReset={() => setQuery({ source: null, entity: null })} {filters} {trailing} />
<CatalogList rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} filtered={Boolean(source || entity)} emptyText="Связей пока нет" ariaLabel="Связи с внешними системами" />
