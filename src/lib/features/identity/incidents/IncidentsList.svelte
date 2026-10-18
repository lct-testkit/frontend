<script lang="ts">
	// Реестр инцидентов ПДн: вкладка по статусам в адресной строке, курсорная подгрузка, у каждого — ближайший срок уведомления РКН; строка ведёт в карточку.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { DataTable, DateText, EmptyState, StatusChip, TableCell, type Col } from '$lib/ui';
	import { readQuery } from '$lib/utils/query-state.svelte';
	import { currentDeadline, incidentStatusHint, incidentStatusMeta, severityMeta, statusTab, tabStatuses, type Incident } from './incidents';

	const tab = $derived(statusTab(readQuery('status')));
	const statuses = $derived(tabStatuses(tab));

	const pager = createPager<Incident>((cursor, signal) => unwrap(api.GET('/api/admin/incidents', { params: { query: { status: statuses, limit: 50, cursor } }, signal })));
	onMount(() => () => pager.abort());
	$effect(() => {
		void tab;
		void pager.reload();
	});

	export function reload() {
		void pager.reload();
	}

	// «Осталось …» обновляется раз в минуту
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});
	const deadline = (i: Incident) => currentDeadline(i, now);
	const stageLabel = { '24h': 'РКН 24 ч', '72h': 'РКН 72 ч' } as const;
	const toneClass = (state: string) => (state === 'overdue' ? 'text-danger' : state === 'soon' ? 'text-warning' : 'text-muted');

	const columns: Col<Incident>[] = [
		{ key: 'number', title: 'Номер', render: numberCell },
		{ key: 'title', title: 'Название', width: 'minmax(220px, 2fr)', render: titleCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'severity', title: 'Серьёзность', drop: 2, render: severityCell },
		{ key: 'deadline', title: 'Срок', width: 'minmax(230px, 1fr)', drop: 1, render: deadlineCell },
		{ key: 'detected', title: 'Выявлен', drop: 3, render: detectedCell }
	];
</script>

{#snippet numberCell(i: Incident)}<TableCell><span class="t-body-s font-mono text-muted">{i.number}</span></TableCell>{/snippet}
{#snippet titleCell(i: Incident)}<TableCell><span class="t-body-m-strong truncate" title={i.title}>{i.title}</span></TableCell>{/snippet}
{#snippet statusCell(i: Incident)}
	<TableCell>{@const meta = incidentStatusMeta(i.status)}<StatusChip label={meta.label} tone={meta.tone} hint={incidentStatusHint(i.status)} /></TableCell>
{/snippet}
{#snippet severityCell(i: Incident)}
	<TableCell>{@const meta = severityMeta(i.severity)}<StatusChip label={meta.label} tone={meta.tone} /></TableCell>
{/snippet}
{#snippet deadlineCell(i: Incident)}
	<TableCell>
		{@const d = deadline(i)}
		{#if d}<span class={['t-body-s truncate', toneClass(d.info.state)]}>{stageLabel[d.stage]}: {d.info.label.toLowerCase()}</span>{:else}<span class="text-soft">—</span>{/if}
	</TableCell>
{/snippet}
{#snippet detectedCell(i: Incident)}<TableCell>{#if i.detected_at}<span class="t-body-s"><DateText value={i.detected_at} time /></span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}

{#snippet card(i: Incident)}
	{@const status = incidentStatusMeta(i.status)}
	{@const d = deadline(i)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-m-strong min-w-0 wrap-anywhere">{i.title}</span>
			<span class="flex-none"><StatusChip label={status.label} tone={status.tone} hint={incidentStatusHint(i.status)} /></span>
		</div>
		<span class="t-desc-l flex flex-wrap gap-x-1 text-muted"><span class="font-mono">{i.number}</span><span aria-hidden="true">·</span><span>{severityMeta(i.severity).label}</span></span>
		{#if d}<span class={['t-desc-l', toneClass(d.info.state)]}>{stageLabel[d.stage]}: {d.info.label.toLowerCase()}</span>{/if}
	</div>
{/snippet}

<DataTable
	id="admin-incidents"
	rows={pager.items}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={(i) => goto(`/admin/incidents/${i.id}`)}
	rowHref={(i) => `/admin/incidents/${i.id}`}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	ariaLabel="Инциденты ПДн"
>
	{#snippet empty()}
		<EmptyState title={tab === 'all' ? 'Инцидентов нет' : 'В этой вкладке инцидентов нет'} hint={tab === 'all' ? 'Кандидатов заводит система по событиям безопасности; утечку можно завести и вручную.' : undefined} />
	{/snippet}
</DataTable>
