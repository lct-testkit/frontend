<script lang="ts">
	// Список сделок: таблица (от 768 px) или карточки (телефон). Данные и пагинация — у родителя (Pager).
	// Одна строка на сделку, у всех одна высота: организация, статус, срок, приоритет — свои колонки; что не помещается, убирается
	// по порядку `drop` (сначала «Изменён», потом «Приоритет»…), а не режется и не прокручивается вбок.
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { people } from '$lib/api/people.svelte';
	import type { Pager } from '$lib/api/pager.svelte';
	import { DataTable, DateText, Money, TableCell, UserName, type Col, type SortState } from '$lib/ui';
		import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import { contactCache, contactLabel, orgCache, orgLabel } from '../../shared/entityCache.svelte';
	import { PRIORITY_LABELS } from '../../shared/labels';
	import type { Deal } from '../../types';
	import DealStatusChip from '../DealStatusChip.svelte';
	import { workflows } from '../workflows.svelte';

	interface Props {
		pager: Pager<Deal>;
		fill?: boolean;
		selectable?: boolean;
		selected?: string[];
		onSelect?: (keys: string[]) => void;
		actionBar?: Snippet;
		empty?: Snippet;
		/** узкий контейнер (карточка контакта): три колонки — сделка, статус, сумма */
		compact?: boolean;
		/** колонка «Ответственный»: нужна тем, кто видит чужие сделки */
		showOwner?: boolean;
		/** внутри карточки-секции: без своей рамки */
		embedded?: boolean;
	}

	let { pager, fill = false, selectable = false, selected = [], onSelect, actionBar, empty, compact = false, showOwner = false, embedded = false }: Props = $props();

	// клиент сортирует то, что уже загружено; серверные `sort`, `total`, `is_closed` бэкенд отдаёт с 25.09 (backend-issues A-11), но список их пока не использует
	let sort = $state<SortState | null>(null);

	const rows = $derived.by(() => {
		if (!sort) return pager.items;
		const { key, dir } = sort;
		const sign = dir === 'asc' ? 1 : -1;
		const value = (d: Deal): number | string => {
			if (key === 'amount') return d.amount === null || d.amount === undefined ? -Infinity : Number(d.amount);
			if (key === 'updated_at') return Date.parse(d.updated_at);
			if (key === 'title') return d.title.toLowerCase();
			return d.number;
		};
		return [...pager.items].sort((a, b) => {
			const x = value(a);
			const y = value(b);
			return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'ru') : Number(x) - Number(y)) * sign;
		});
	});

	// имена связанных сущностей: одним пакетом на пришедшую страницу
	$effect(() => {
		orgCache.ensure(pager.items.map((d) => d.organization_id));
		contactCache.ensure(pager.items.filter((d) => !d.organization_id).map((d) => d.contact_id));
		people.ensure(pager.items.map((d) => d.owner_id));
		workflows.ensureMany(pager.items.map((d) => d.workflow_id));
	});

	const party = (d: Deal): string => (d.organization_id ? orgLabel(d.organization_id) : d.contact_id ? contactLabel(d.contact_id) : '');

	function open(row: Deal) {
		void goto(`/deals/${row.id}`);
	}
	// ссылка в ячейке работает и как обычная (в новой вкладке); обычный клик обрабатывает строка
	function link(e: MouseEvent) {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) e.stopPropagation();
		else e.preventDefault();
	}

	const fullColumns: Col<Deal>[] = $derived([
		{ key: 'number', title: 'Номер', render: numberCell, sortable: true },
		{ key: 'title', title: 'Сделка', width: 'minmax(160px, 3fr)', render: titleCell, sortable: true },
		{ key: 'party', title: 'Организация', width: 'minmax(140px, 2fr)', render: partyCell, drop: 3 },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'sla', title: 'Срок', hint: 'Срок (SLA): сколько сделка может пробыть в текущем статусе', render: slaCell, drop: 2 },
		{ key: 'amount', title: 'Сумма', align: 'right' as const, render: amountCell, sortable: true },
		...(showOwner ? [{ key: 'owner', title: 'Ответственный', render: ownerCell, drop: 4 }] : []),
		{ key: 'updated_at', title: 'Изменён', render: updatedCell, sortable: true, drop: 1 }
	]);
	const compactColumns: Col<Deal>[] = [
		{ key: 'title', title: 'Сделка', width: 'minmax(120px, 1fr)', render: compactTitleCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'amount', title: 'Сумма', align: 'right', render: amountCell }
	];
	const columns = $derived(compact ? compactColumns : fullColumns);
</script>

{#snippet numberCell(row: Deal)}
	<TableCell><a href="/deals/{row.id}" class="whitespace-nowrap text-fg" onclick={link}>{row.number}</a></TableCell>
{/snippet}
{#snippet titleCell(row: Deal)}
	<TableCell>
		{#if row.priority === 'high' || row.priority === 'critical'}<span class={['size-2 flex-none rounded-full', row.priority === 'critical' ? 'bg-danger' : 'bg-warning']} title={PRIORITY_LABELS[row.priority]} role="img" aria-label={PRIORITY_LABELS[row.priority]}></span>{/if}
		<span class="truncate font-medium" title={row.title}>{row.title}</span>
	</TableCell>
{/snippet}
{#snippet compactTitleCell(row: Deal)}
	<TableCell><a href="/deals/{row.id}" class="truncate font-medium text-fg" title="{row.number} · {row.title}" onclick={link}>{row.title}</a></TableCell>
{/snippet}
{#snippet partyCell(row: Deal)}<TableCell><span class="truncate">{party(row) || '—'}</span></TableCell>{/snippet}
{#snippet statusCell(row: Deal)}<TableCell><DealStatusChip statusId={row.status_id} /></TableCell>{/snippet}
{#snippet slaCell(row: Deal)}<TableCell><SlaIndicator deal={row} compact /></TableCell>{/snippet}
{#snippet amountCell(row: Deal)}<TableCell align="right"><Money value={row.amount} currency={row.currency} /></TableCell>{/snippet}
{#snippet ownerCell(row: Deal)}<TableCell><span class="truncate"><UserName id={row.owner_id} /></span></TableCell>{/snippet}
{#snippet updatedCell(row: Deal)}<TableCell><span class="text-muted"><DateText value={row.updated_at} relative /></span></TableCell>{/snippet}

{#snippet card(row: Deal)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-center justify-between gap-2">
			<span class="t-desc-l text-muted">{row.number}</span>
			<DealStatusChip statusId={row.status_id} />
		</div>
		<span class="t-row-strong break-words">{row.title}</span>
		<span class="t-desc-l truncate text-muted">{party(row)}</span>
		<div class="flex items-center justify-between gap-2">
			<span class="t-body-s-strong"><Money value={row.amount} currency={row.currency} short /></span>
			<SlaIndicator deal={row} />
		</div>
	</div>
{/snippet}

<DataTable
	id="deals"
	{rows}
	{columns}
	{card}
	{fill}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={open}
	rowHref={(row) => `/deals/${row.id}`}
	{sort}
	onSort={(next) => (sort = next)}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	{selectable}
	{selected}
	onSelectionChange={onSelect}
	{actionBar}
	{empty}
	ariaLabel="Сделки"
	{embedded}
/>
