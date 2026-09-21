<script lang="ts">
	// Мои отчёты: статус, формат, строки, срок хранения; скачать можно готовый и не истёкший. Пока есть отчёты в работе — список обновляется сам.
	import { onDestroy, onMount } from 'svelte';
	import { Download, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { DateText, EmptyState, IconBtn, Page, PageHeader, DataTable, StatusChip, toast, type Col, TableCell } from '$lib/ui';
	import type { ReportJob, ReportTemplate } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import { createPoller } from '../shared/polling.svelte';
	import { downloadReport } from './api';
	import { REPORT_FORMAT_LABELS, REPORT_STATUS_INFO, canDownloadReport, isReportBusy, isReportExpired, type ReportFormat, type ReportStatus } from './params';
	import ReportTabs from './ReportTabs.svelte';

	const pager = createPager<ReportJob>((cursor, signal) => unwrap(api.GET('/api/reports', { params: { query: { limit: 50, cursor } }, signal })));
	const templates = createResource((signal) => unwrap(api.GET('/api/report-templates', { signal })).then((r) => r.items as ReportTemplate[]));
	const poller = createPoller(async () => {
		await pager.reload();
		return pager.items.some((j) => isReportBusy(j.status));
	}, { interval: 3000 });

	onMount(async () => {
		void templates.reload();
		await pager.reload();
		if (pager.items.some((j) => isReportBusy(j.status))) poller.start();
	});
	onDestroy(() => poller.stop());

	const nameOf = (code: string) => templates.data?.find((t) => t.code === code)?.name ?? code;
	const info = (s: string) => REPORT_STATUS_INFO[s as ReportStatus] ?? { label: s, tone: 'neutral' as const };

	async function save(j: ReportJob) {
		try {
			await downloadReport(j.id);
		} catch (e) {
			toast.error(e);
		}
	}

	const columns: Col<ReportJob>[] = [
		{ key: 'name', title: 'Отчёт', width: 'minmax(200px, 1.6fr)', render: nameCell },
		{ key: 'format', title: 'Формат', drop: 3, render: formatCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'rows', title: 'Строк', align: 'right', drop: 2, render: rowsCell },
		{ key: 'created', title: 'Создан', render: createdCell },
		{ key: 'keep', title: 'Хранится до', drop: 1, render: keepCell },
		{ key: 'dl', title: '', render: dlCell }
	];
</script>

{#snippet nameCell(j: ReportJob)}<TableCell><span class="t-body-m-strong wrap-anywhere">{nameOf(j.template_code)}</span></TableCell>{/snippet}
{#snippet formatCell(j: ReportJob)}<TableCell><span class="t-body-s">{REPORT_FORMAT_LABELS[j.format as ReportFormat] ?? j.format}</span></TableCell>{/snippet}
{#snippet statusCell(j: ReportJob)}
	<TableCell>
		{#if isReportExpired(j)}<span class="t-desc-l text-soft">Срок хранения истёк</span>{:else}<StatusChip label={info(j.status).label} tone={info(j.status).tone} title={j.error ?? undefined} />{/if}
	</TableCell>
{/snippet}
{#snippet rowsCell(j: ReportJob)}<TableCell align="right"><span class="t-body-s tabular-nums">{j.row_count ?? '—'}</span></TableCell>{/snippet}
{#snippet createdCell(j: ReportJob)}<TableCell><span class="t-body-s"><DateText value={j.created_at} time /></span></TableCell>{/snippet}
{#snippet keepCell(j: ReportJob)}<TableCell>{#if j.expires_at}<span class="t-body-s"><DateText value={j.expires_at} /></span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet dlCell(j: ReportJob)}<TableCell>{#if canDownloadReport(j)}<IconBtn icon={Download} label="Скачать" onclick={(e) => (e.stopPropagation(), void save(j))} />{/if}</TableCell>{/snippet}

{#snippet card(j: ReportJob)}
	<div class="flex min-w-0 items-center gap-3">
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="t-body-m-strong wrap-anywhere">{nameOf(j.template_code)}</span>
			<span class="t-desc-l flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
				{REPORT_FORMAT_LABELS[j.format as ReportFormat] ?? j.format} · <DateText value={j.created_at} time />
			</span>
			{#if isReportExpired(j)}<span class="t-desc-l text-soft">Срок хранения истёк</span>{:else}<span><StatusChip label={info(j.status).label} tone={info(j.status).tone} /></span>{/if}
		</div>
		{#if canDownloadReport(j)}<IconBtn icon={Download} label="Скачать" size="l" onclick={(e) => (e.stopPropagation(), void save(j))} />{/if}
	</div>
{/snippet}

<Page>
	<PageHeader title="Отчёты">
		{#snippet tabs(underline)}<ReportTabs active="history" {underline} />{/snippet}
		{#snippet actions()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}
	</PageHeader>
	<DataTable
		rows={pager.items}
		{columns}
		{card}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		ariaLabel="Мои отчёты"
	>
		{#snippet empty()}<EmptyState title="Вы ещё не запускали отчёты" />{/snippet}
	</DataTable>
</Page>
