<script lang="ts">
	// Результат по строкам файла: какая строка прошла, какая нет и почему (`GET /api/imports/{id}/rows`). Значения ПДн сервер маскирует.
	// Замечания — структурные (`issues`: сообщение, что делать, серьёзность). Фильтр — вкладки «Ошибки / Предупреждения / Все» и, если выбран, код проблемы из сводки.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Btn, DataTable, EmptyState, StatusChip, TableCell, type Col } from '$lib/ui';
	import { importRowHint } from './hints';
	import TabsBar from '$lib/ui/TabsBar.svelte';
	import type { components } from '$lib/api';
	import { rowRemarks, rowLabel } from './check';
	import { rowSummary } from './job';
	import { rowStatus } from './mapping';

	type Row = components['schemas']['ImportRowOut'];

	interface Props {
		jobId: string;
		total: number;
		warn: number;
		error: number;
		/** код проблемы из сводки: показать только строки с ним */
		issue?: string | null;
		/** подпись выбранной проблемы (для плашки «Только: …») */
		issueLabel?: string | null;
		onClearIssue?: () => void;
	}

	let { jobId, total, warn, error, issue = null, issueLabel = null, onClearIssue }: Props = $props();

	let filter = $state<string>('');
	let started = false;
	const tabs = $derived([
		{ key: 'error', label: 'Ошибки', count: error },
		{ key: 'warn', label: 'Предупреждения', count: warn },
		{ key: '', label: 'Все', count: total }
	]);

	const pager = createPager<Row>((cursor, signal) =>
		unwrap(api.GET('/api/imports/{job_id}/rows', { params: { path: { job_id: jobId }, query: { limit: 50, cursor, status: filter || undefined, issue: issue || undefined } }, signal }))
	);
	// проблема из сводки сама по себе сужает список: вкладка — «Все»
	$effect(() => {
		void issue;
		untrack(() => {
			if (!started) {
				// открыта вкладка, где есть что смотреть
				started = true;
				filter = error > 0 ? 'error' : warn > 0 ? 'warn' : '';
			}
			if (issue) filter = '';
			void pager.reload();
		});
	});

	function choose(key: string) {
		filter = key;
		void pager.reload();
	}

	const multiSheet = $derived(new Set(pager.items.map((r) => r.sheet).filter(Boolean)).size > 1);
	const summary = (row: Row): string => rowSummary(row.row_data);
	const remarkList = (row: Row) => rowRemarks(row);
	// в таблице — первое замечание и «+N»; все замечания с подсказками — в `title`
	const allRemarks = (row: Row): string => remarkList(row).map((r) => (r.fix ? `${r.text}\n→ ${r.fix}` : r.text)).join('\n\n');
	const remarkTone = (severity: string) => (severity === 'warning' ? 'text-warning' : 'text-danger');

	const columns: Col<Row>[] = [
		{ key: 'n', title: 'Строка', width: 96, render: numberCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'who', title: 'Запись', width: 'minmax(160px, 1fr)', drop: 1, render: whoCell },
		{ key: 'remarks', title: 'Замечания', width: 'minmax(240px, 3fr)', render: remarksCell }
	];
</script>

{#snippet numberCell(r: Row)}<TableCell><span class="t-body-s tabular-nums truncate" title={r.sheet ?? undefined}>{rowLabel(r, multiSheet)}</span></TableCell>{/snippet}
{#snippet statusCell(r: Row)}<TableCell><StatusChip label={rowStatus(r.status).label} tone={rowStatus(r.status).tone} hint={importRowHint(r.status)} /></TableCell>{/snippet}
{#snippet whoCell(r: Row)}<TableCell><span class="t-body-s truncate" title={summary(r)}>{summary(r) || '—'}</span></TableCell>{/snippet}
{#snippet remarksCell(r: Row)}
	{@const list = remarkList(r)}
	<TableCell>
		<span class={['t-body-s truncate', list[0] && remarkTone(list[0].severity)]} title={allRemarks(r)}>{list[0]?.text ?? '—'}</span>
		{#if list.length > 1}<span class="t-body-s flex-none text-muted" title={allRemarks(r)}>+{list.length - 1}</span>{/if}
	</TableCell>
{/snippet}

{#snippet card(r: Row)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-m-strong">Строка {rowLabel(r, multiSheet)}</span>
			<StatusChip label={rowStatus(r.status).label} tone={rowStatus(r.status).tone} hint={importRowHint(r.status)} />
		</div>
		{#if summary(r)}<span class="t-desc-l wrap-anywhere text-muted">{summary(r)}</span>{/if}
		{#each remarkList(r) as remark (remark.text)}
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class={['t-desc-l wrap-anywhere', remarkTone(remark.severity)]}>{remark.text}</span>
				{#if remark.fix}<span class="t-desc-l wrap-anywhere text-muted">{remark.fix}</span>{/if}
				{#if remark.link}<a href={remark.link.href} class="t-desc-l text-accent">{remark.link.label}</a>{/if}
			</div>
		{/each}
	</div>
{/snippet}

<section class="flex flex-col gap-3" aria-label="Результат по строкам">
	<h2 class="t-h5">Строки файла</h2>
	<TabsBar items={tabs} value={filter} onChange={choose} label="Какие строки показывать" />
	{#if issue}
		<div class="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
			<span class="t-body-s min-w-0 flex-1 wrap-anywhere">Только строки с замечанием: {issueLabel ?? issue}</span>
			<Btn label="Показать все" variant="ghost" colorScheme="neutral" size="auto" onclick={() => onClearIssue?.()} />
		</div>
	{/if}
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
		ariaLabel="Результат по строкам файла"
	>
		{#snippet empty()}
			<EmptyState title={issue ? 'Строк с этим замечанием нет' : filter === 'error' ? 'Ошибок нет' : filter === 'warn' ? 'Предупреждений нет' : 'Строк нет'} compact />
		{/snippet}
	</DataTable>
</section>
