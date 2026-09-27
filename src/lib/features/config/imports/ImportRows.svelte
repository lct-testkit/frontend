<script lang="ts">
	// Результат по строкам файла: какая строка прошла, какая нет и почему (`GET /api/imports/{id}/rows`). Значения ПДн сервер маскирует.
	// Фильтр — вкладки «Ошибки / Предупреждения / Все»; по умолчанию открыта та, где есть что смотреть.
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { DataTable, EmptyState, StatusChip, TableCell, type Col } from '$lib/ui';
	import { importRowHint } from './hints';
	import TabsBar from '$lib/ui/TabsBar.svelte';
	import type { components } from '$lib/api';
	import { rowStatus } from './mapping';

	type Row = components['schemas']['ImportRowOut'];

	interface Props {
		jobId: string;
		total: number;
		warn: number;
		error: number;
	}

	let { jobId, total, warn, error }: Props = $props();

	let filter = $state<string>('');
	const tabs = $derived([
		{ key: 'error', label: 'Ошибки', count: error },
		{ key: 'warn', label: 'Предупреждения', count: warn },
		{ key: '', label: 'Все', count: total }
	]);

	const pager = createPager<Row>((cursor, signal) =>
		unwrap(api.GET('/api/imports/{job_id}/rows', { params: { path: { job_id: jobId }, query: { limit: 50, cursor, status: filter || undefined } }, signal }))
	);
	onMount(() => {
		// открыта вкладка, где есть что смотреть
		filter = error > 0 ? 'error' : warn > 0 ? 'warn' : '';
		void pager.reload();
	});

	function choose(key: string) {
		filter = key;
		void pager.reload();
	}

	// Что за запись в строке: сначала поля, по которым её узнают (номер заявки, название, ФИО), потом остальные.
	const IDENTIFYING = ['order_number', 'vendor_name', 'name', 'full_name', 'last_name', 'first_name', 'middle_name', 'code', 'inn'];
	const summary = (row: Row): string => {
		const data = row.row_data ?? {};
		const keys = [...IDENTIFYING.filter((k) => k in data), ...Object.keys(data).filter((k) => !IDENTIFYING.includes(k))];
		return keys
			.map((k) => data[k])
			.filter((v) => v !== null && v !== '' && v !== undefined && typeof v !== 'object')
			.slice(0, 3)
			.join(' · ');
	};
	const remarks = (row: Row): string => (row.errors?.length ? row.errors.join('; ') : '—');

	const columns: Col<Row>[] = [
		{ key: 'n', title: 'Строка', width: 84, render: numberCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'who', title: 'Запись', width: 'minmax(160px, 1fr)', drop: 1, render: whoCell },
		{ key: 'remarks', title: 'Замечания', width: 'minmax(240px, 3fr)', render: remarksCell }
	];
</script>

{#snippet numberCell(r: Row)}<TableCell><span class="t-body-s tabular-nums">{r.row_number}</span></TableCell>{/snippet}
{#snippet statusCell(r: Row)}<TableCell><StatusChip label={rowStatus(r.status).label} tone={rowStatus(r.status).tone} hint={importRowHint(r.status)} /></TableCell>{/snippet}
{#snippet whoCell(r: Row)}<TableCell><span class="t-body-s truncate" title={summary(r)}>{summary(r) || '—'}</span></TableCell>{/snippet}
{#snippet remarksCell(r: Row)}<TableCell><span class="t-body-s truncate" title={remarks(r)}>{remarks(r)}</span></TableCell>{/snippet}

{#snippet card(r: Row)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-m-strong">Строка {r.row_number}</span>
			<StatusChip label={rowStatus(r.status).label} tone={rowStatus(r.status).tone} hint={importRowHint(r.status)} />
		</div>
		{#if summary(r)}<span class="t-desc-l wrap-anywhere text-muted">{summary(r)}</span>{/if}
		{#each r.errors ?? [] as e (e)}<span class="t-desc-l wrap-anywhere">{e}</span>{/each}
	</div>
{/snippet}

<section class="flex flex-col gap-3" aria-label="Результат по строкам">
	<h2 class="t-h5">Строки файла</h2>
	<TabsBar items={tabs} value={filter} onChange={choose} label="Какие строки показывать" />
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
			<EmptyState title={filter === 'error' ? 'Ошибок нет' : filter === 'warn' ? 'Предупреждений нет' : 'Строк нет'} compact />
		{/snippet}
	</DataTable>
</section>
