<script lang="ts">
	// Журнал аудита: фильтры в URL, курсорная подгрузка, строка открывает подробности. `trailing` — кнопки страницы: они стоят в строке фильтров.
	import type { Snippet } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { auditActionLabel, auditResultMeta, entityTypeLabel } from '../labels';
	import { shortId } from '../audit';
	import type { AuditEntry } from '../types';
	import AuditDetails from './AuditDetails.svelte';
	import AuditFilters from './AuditFilters.svelte';
	import { AUDIT_FILTER_KEYS, apiQuery, type AuditFilters as Filters } from './audit-query';

	let { trailing }: { trailing?: Snippet } = $props();

	const values = $derived(Object.fromEntries(AUDIT_FILTER_KEYS.map((k) => [k, readQuery(k)])) as unknown as Filters);
	const key = $derived(JSON.stringify(values));
	let current = $state<AuditEntry | null>(null);

	const pager = createPager<AuditEntry>((cursor, signal) =>
		unwrap(api.GET('/api/admin/audit', { params: { query: { ...apiQuery(values), limit: 50, cursor } }, signal })).then((page) => {
			people.ensure(page.items.map((i) => i.actor_id));
			return page;
		})
	);

	$effect(() => {
		void key;
		void pager.reload();
	});

	const columns: Col<AuditEntry>[] = [
		{ key: 'time', title: 'Время', render: time },
		{ key: 'actor', title: 'Сотрудник', width: 'minmax(150px, 1.2fr)', drop: 2, render: actor },
		{ key: 'action', title: 'Действие', width: 'minmax(170px, 2fr)', render: action },
		{ key: 'entity', title: 'Сущность', width: 'minmax(150px, 1.2fr)', drop: 1, render: entity },
		{ key: 'result', title: 'Результат', render: result }
	];
</script>

{#snippet time(e: AuditEntry)}<TableCell><DateText value={e.created_at} time /></TableCell>{/snippet}
{#snippet actor(e: AuditEntry)}<TableCell><span class="truncate">{e.actor_id ? people.name(e.actor_id) : 'Система'}</span></TableCell>{/snippet}
{#snippet action(e: AuditEntry)}<TableCell><span class="block truncate py-1.5" title={e.action}>{auditActionLabel(e.action)}</span></TableCell>{/snippet}
{#snippet entity(e: AuditEntry)}
	<TableCell>
		<span class="flex min-w-0 gap-1">
			<span class="truncate">{entityTypeLabel(e.entity_type)}</span>
			{#if e.entity_id}<span class="shrink-0 text-muted">{shortId(e.entity_id).slice(0, 8)}</span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet result(e: AuditEntry)}
	<TableCell>
		{@const meta = auditResultMeta(e.result)}
		<StatusChip label={meta.label} tone={meta.tone} />
	</TableCell>
{/snippet}
{#snippet card(e: AuditEntry)}
	{@const meta = auditResultMeta(e.result)}
	<div class="flex flex-col gap-1 p-1">
		<div class="flex items-start gap-2">
			<span class="t-body-m-strong min-w-0 flex-1 break-words">{auditActionLabel(e.action)}</span>
			<StatusChip label={meta.label} tone={meta.tone} />
		</div>
		<span class="t-desc-l text-muted">{e.actor_id ? people.name(e.actor_id) : 'Система'} · <DateText value={e.created_at} time /></span>
	</div>
{/snippet}

<AuditFilters {values} {trailing} onChange={(patch) => void setQuery(patch)} />
<DataTable
	id="audit"
	rows={pager.items}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={(e) => (current = e)}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText="Событий по этим условиям нет"
	ariaLabel="Журнал аудита"
/>
<AuditDetails entry={current} onClose={() => (current = null)} />
