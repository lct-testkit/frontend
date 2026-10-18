<script lang="ts">
	// Вкладка «Этапы»: контроль исполнения (шаг 14 задания) — по каждому этапу воронки: пройден ли, сколько времени занял,
	// уложились ли в срок, сколько комментариев и файлов, какие вложения нужны для перехода вперёд и чего не хватает.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { Card, DataTable, StatusChip, TableCell, type Col } from '$lib/ui';
	import type { DealStages, StageItem } from '../../types';
	import { statusName } from '../statusUtils';
	import { STAGE_STATES, stageEvidence, stageSla, stageTime, stageVisitsNote, stagesSummary } from './stages';

	let { dealId, refreshKey = 0 }: { dealId: string; refreshKey?: number } = $props();

	let data = $state<DealStages | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let seq = 0;

	async function load() {
		const mine = ++seq;
		loading = true;
		error = null;
		try {
			const next = await unwrap(api.GET('/api/deals/{deal_id}/stages', { params: { path: { deal_id: dealId } } }));
			if (mine === seq) data = next;
		} catch (e) {
			if (mine === seq) error = e;
		} finally {
			if (mine === seq) loading = false;
		}
	}

	// первая загрузка и после перехода/подписи: этапы пересчитываются на сервере
	$effect(() => {
		void refreshKey;
		untrack(() => void load());
	});

	type Row = StageItem & { id: string; index: number };
	const rows = $derived<Row[]>((data?.items ?? []).map((item, i) => ({ ...item, id: item.status_id, index: i + 1 })));

	const columns: Col<Row>[] = [
		{ key: 'name', title: 'Этап', width: 'minmax(200px, 3fr)', render: nameCell },
		{ key: 'state', title: 'Состояние', render: stateCell },
		{ key: 'time', title: 'Время', hint: 'Сколько сделка пробыла на этапе', render: timeCell },
		{ key: 'sla', title: 'Срок', width: 'minmax(150px, 1fr)', render: slaCell },
		{ key: 'comments', title: 'Комм.', hint: 'Комментарии на этапе', align: 'right', render: commentsCell, drop: 2 },
		{ key: 'files', title: 'Файлы', hint: 'Файлы, приложенные на этапе', align: 'right', render: filesCell, drop: 1 },
		{ key: 'evidence', title: 'Вложения', hint: 'Вложения, нужные для перехода вперёд', width: 'minmax(150px, 1.4fr)', render: evidenceCell }
	];
</script>

{#snippet nameCell(row: Row)}
	<TableCell><span class="w-5 flex-none text-right text-muted tabular-nums">{row.index}</span><span class="truncate" title={statusName(row.name)}>{statusName(row.name)}</span></TableCell>
{/snippet}
{#snippet stateCell(row: Row)}
	{@const s = STAGE_STATES[row.state]}
	<TableCell><StatusChip label={s.label} tone={s.tone} /></TableCell>
{/snippet}
{#snippet timeCell(row: Row)}
	{@const note = stageVisitsNote(row.visits)}
	<TableCell><span class="whitespace-nowrap">{stageTime(row)}</span>{#if note}<span class="t-desc-l whitespace-nowrap text-muted">{note}</span>{/if}</TableCell>
{/snippet}
{#snippet slaCell(row: Row)}
	{@const s = stageSla(row)}
	<TableCell><span class={['truncate', s.tone === 'error' && 'text-danger', s.tone === 'neutral' && 'text-muted']} title={s.text}>{s.text}</span></TableCell>
{/snippet}
{#snippet commentsCell(row: Row)}<TableCell align="right"><span class={row.comments_count ? '' : 'text-muted'}>{row.comments_count}</span></TableCell>{/snippet}
{#snippet filesCell(row: Row)}<TableCell align="right"><span class={row.files_count ? '' : 'text-muted'}>{row.files_count}</span></TableCell>{/snippet}
{#snippet evidenceCell(row: Row)}
	{@const e = stageEvidence(row)}
	<TableCell>
		{#if e.kind === 'none'}<span class="text-muted">—</span>{:else}<StatusChip label={e.text} tone={e.tone} />{/if}
	</TableCell>
{/snippet}

{#snippet card(row: Row)}
	{@const s = STAGE_STATES[row.state]}
	{@const sla = stageSla(row)}
	{@const e = stageEvidence(row)}
	{@const note = stageVisitsNote(row.visits)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2">
			<span class="t-row-strong min-w-0 break-words">{row.index}. {statusName(row.name)}</span>
			<StatusChip label={s.label} tone={s.tone} />
		</div>
		<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
			<span class="t-desc-l text-muted">Время на этапе</span>
			<span class="t-desc-l">{stageTime(row)}{note ? ` · ${note}` : ''}</span>
		</div>
		<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
			<span class="t-desc-l text-muted">Срок</span>
			<span class={['t-desc-l', sla.tone === 'error' && 'text-danger']}>{sla.text}</span>
		</div>
		<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-3">
			<span class="t-desc-l text-muted">Комментарии, файлы</span>
			<span class="t-desc-l">{row.comments_count}, {row.files_count}</span>
		</div>
		{#if e.kind !== 'none'}
			<div class="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-x-3">
				<span class="t-desc-l text-muted">Вложения для перехода</span>
				<span class="flex min-w-0"><StatusChip label={e.text} tone={e.tone} /></span>
			</div>
		{/if}
	</div>
{/snippet}

<Card title="Исполнение этапов" flush>
	{#if data}<p class="t-desc-l m-0 px-[15px] pb-2 text-muted" data-testid="stages-summary">{stagesSummary(data)}</p>{/if}
	<DataTable id="deal-stages" {rows} {columns} {card} {loading} {error} onRetry={load} embedded noFooter ariaLabel="Этапы сделки" emptyText="В воронке нет этапов" />
</Card>
