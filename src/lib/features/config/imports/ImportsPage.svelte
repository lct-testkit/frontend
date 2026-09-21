<script lang="ts">
	// Журнал заданий импорта. Незавершённое задание открывает мастер с нужного шага, завершённое — карточку с итогами.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Btn, DataTable, DateText, EmptyState, ErrorState, FilterBar, Page, PageHeader, StatusChip, TableCell, type Col } from '$lib/ui';
	import { people } from '$lib/api/people.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import UserName from '$lib/ui/UserName.svelte';
	import { ApiError } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { formatNumber } from '$lib/utils/format';
	import type { ImportJob } from '../types';
	import { entityLabel, isDraftJob, jobStatus, modeLabel } from './job';

	const pager = createPager<ImportJob>((cursor, signal) => unwrap(api.GET('/api/imports', { params: { query: { limit: 50, cursor } }, signal })));
	onMount(() => void pager.reload());

	const allowed = $derived(session.can('import:run'));

	// the journal has no server-side search: the search looks through the jobs that are loaded (what was loaded, how, the status, who)
	const q = $derived(readQuery('q').trim().toLowerCase());
	$effect(() => people.ensure(pager.items.map((j) => j.initiated_by)));
	const rows = $derived(
		q ? pager.items.filter((j) => [entityLabel(j.entity_type), modeLabel(j.mode), j.source_format, jobStatus(j.status).label, people.name(j.initiated_by, '')].some((text) => text.toLowerCase().includes(q))) : pager.items
	);
	const open = (j: ImportJob) => goto(isDraftJob(j) ? `/imports/new?job=${j.id}` : `/imports/${j.id}`);

	const columns: Col<ImportJob>[] = [
		{ key: 'entity', title: 'Что загружали', width: 'minmax(200px, 1.4fr)', render: entityCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'rows', title: 'Строки', drop: 2, render: rowsCell },
		{ key: 'by', title: 'Кто', width: 'minmax(140px, 1fr)', drop: 1, render: byCell },
		{ key: 'created', title: 'Когда', render: whenCell }
	];
</script>

{#snippet entityCell(j: ImportJob)}
	<TableCell>
		<span class="flex min-w-0 flex-col">
			<span class="t-body-m-strong">{entityLabel(j.entity_type)}</span>
			<span class="t-desc-m text-soft">{modeLabel(j.mode)} · {j.source_format.toUpperCase()}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet statusCell(j: ImportJob)}<TableCell><StatusChip label={jobStatus(j.status).label} tone={jobStatus(j.status).tone} /></TableCell>{/snippet}
{#snippet rowsCell(j: ImportJob)}
	<TableCell>
		<span class="t-body-s tabular-nums" title="без замечаний · с предупреждениями · с ошибками">
			{formatNumber(j.total_rows)}
			{#if j.total_rows}<span class="text-soft"> · <span class="text-success">{j.ok_rows}</span> / <span class="text-warning">{j.warn_rows}</span> / <span class="text-danger">{j.error_rows}</span></span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet byCell(j: ImportJob)}<TableCell><span class="t-body-s"><UserName id={j.initiated_by} /></span></TableCell>{/snippet}
{#snippet whenCell(j: ImportJob)}<TableCell><span class="t-body-s"><DateText value={j.created_at} time /></span></TableCell>{/snippet}

{#snippet card(j: ImportJob)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-m-strong">{entityLabel(j.entity_type)}</span>
			<StatusChip label={jobStatus(j.status).label} tone={jobStatus(j.status).tone} />
		</div>
		<span class="t-desc-l text-muted">
			<DateText value={j.created_at} time />{j.total_rows ? ` · ${formatNumber(j.total_rows)} строк` : ''}
		</span>
		{#if j.total_rows && !isDraftJob(j)}
			<span class="t-desc-l tabular-nums text-soft"><span class="text-success">{j.ok_rows}</span> / <span class="text-warning">{j.warn_rows}</span> / <span class="text-danger">{j.error_rows}</span></span>
		{/if}
	</div>
{/snippet}

<Page>
	<PageHeader title="Импорт" />

	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'Импорт доступен руководителю и администратору.' })} />
	{:else}
		<FilterBar search={readQuery('q')} placeholder="Что загружали, статус или кто" onSearch={(v) => setQuery({ q: v || null })} primary={{ label: 'Новый импорт', onclick: () => goto('/imports/new') }} />
		<DataTable
			{rows}
			{columns}
			{card}
			loading={pager.loading}
			error={pager.error}
			onRetry={() => pager.reload()}
			hasMore={pager.hasMore}
			loadingMore={pager.loadingMore}
			onLoadMore={() => pager.loadMore()}
			onRowClick={open}
			ariaLabel="Задания импорта"
		>
			{#snippet empty()}
				{#if q}
					<EmptyState title="Ничего не найдено" compact />
				{:else}
					<EmptyState title="Импортов пока не было">
						{#snippet action()}<Btn label="Новый импорт" icon={AddLarge} onclick={() => goto('/imports/new')} />{/snippet}
					</EmptyState>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</Page>
