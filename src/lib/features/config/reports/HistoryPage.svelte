<script lang="ts">
	// Мои отчёты: статус, формат, строки, срок хранения; скачать можно готовый и не истёкший. Пока есть отчёты в работе — список обновляется сам.
	import { onDestroy, onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { Download, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { DateText, EmptyState, IconBtn, Page, PageHeader, DataTable, StatusChip, toast, type Col, TableCell } from '$lib/ui';
	import type { ReportJob, ReportTemplate } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import { createPoller } from '../shared/polling.svelte';
	import { ReportExpired, downloadReport } from './api';
	import { REPORT_STATUS_INFO, fileState, formatLabel, isReportBusy, type FileState, type ReportStatus } from './params';
	import { jobNoteInput, reportNotes } from './notes';
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

	/** задания, на которые сервер уже ответил 410 в этой сессии: файла нет, даже если срок хранения по дате ещё не вышел */
	const gone = new SvelteSet<string>();
	const stateOf = (j: ReportJob): FileState => fileState(j, { gone: gone.has(j.id) });

	async function save(j: ReportJob) {
		try {
			await downloadReport(j.id);
		} catch (e) {
			if (e instanceof ReportExpired) {
				gone.add(j.id);
				toast.info('Файла уже нет', 'Запустите отчёт заново');
			} else toast.error(e);
		}
	}

	/** «Запустить заново»: открывает галерею с панелью этого отчёта */
	const rerun = (j: ReportJob) => void goto(`/reports?run=${encodeURIComponent(j.template_code)}`);

	/** пометка про усечение по «Не больше строк» (только если сервер сообщил `truncated`) */
	const limitNote = (j: ReportJob): string | undefined => {
		const input = jobNoteInput(j, false);
		return input.truncated === true ? reportNotes(input).find((n) => n.kind === 'truncated')?.text : undefined;
	};

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
{#snippet formatCell(j: ReportJob)}<TableCell><span class="t-body-s">{formatLabel(j.format)}</span></TableCell>{/snippet}
{#snippet statusChip(j: ReportJob)}
	{@const st = stateOf(j)}
	{#if st === 'expired'}
		<StatusChip label="Срок хранения истёк" tone="neutral" hint="Файлы отчётов хранятся 7 дней и удаляются. Запустите отчёт заново" />
	{:else if st === 'gone'}
		<StatusChip label="Файл недоступен" tone="neutral" hint="Файла нет в хранилище: запись без файла или файл удалён. Запустите отчёт заново" />
	{:else}
		<StatusChip label={info(j.status).label} tone={info(j.status).tone} title={j.error ?? undefined} />
	{/if}
{/snippet}
{#snippet statusCell(j: ReportJob)}<TableCell>{@render statusChip(j)}</TableCell>{/snippet}
{#snippet rowsCell(j: ReportJob)}
	<TableCell align="right">
		<span class="inline-flex items-center gap-2">
			{#if limitNote(j)}<StatusChip label="предел" tone="warning" hint={limitNote(j)} />{/if}
			<span class="t-body-s tabular-nums">{j.row_count ?? '—'}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet createdCell(j: ReportJob)}<TableCell><span class="t-body-s"><DateText value={j.created_at} time /></span></TableCell>{/snippet}
{#snippet keepCell(j: ReportJob)}<TableCell>{#if j.expires_at}<span class="t-body-s"><DateText value={j.expires_at} /></span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet actionBtn(j: ReportJob, size: 'm' | 'l')}
	{@const st = stateOf(j)}
	{#if st === 'ready'}
		<IconBtn icon={Download} label="Скачать" {size} onclick={(e) => (e.stopPropagation(), void save(j))} />
	{:else if st === 'expired' || st === 'gone' || st === 'failed'}
		<IconBtn icon={Refresh} label="Запустить заново" {size} onclick={(e) => (e.stopPropagation(), rerun(j))} />
	{/if}
{/snippet}
{#snippet dlCell(j: ReportJob)}<TableCell>{@render actionBtn(j, 'm')}</TableCell>{/snippet}

{#snippet card(j: ReportJob)}
	<div class="flex min-w-0 items-center gap-3">
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="t-body-m-strong wrap-anywhere">{nameOf(j.template_code)}</span>
			<span class="t-desc-l flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
				{formatLabel(j.format)} · <DateText value={j.created_at} time />
			</span>
			<span class="flex flex-wrap items-center gap-2">{@render statusChip(j)}{#if limitNote(j)}<StatusChip label="предел строк" tone="warning" hint={limitNote(j)} />{/if}</span>
		</div>
		{@render actionBtn(j, 'l')}
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
