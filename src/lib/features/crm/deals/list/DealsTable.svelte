<script lang="ts" generics="R extends DealRow">
	// Список сделок: таблица (от 768 px) или карточки (телефон). Данные и пагинация — у родителя (Pager).
	// Одна строка на сделку, у всех одна высота: организация, статус, срок, приоритет — свои колонки; что не помещается, убирается
	// по порядку `drop` (сначала «Изменён», потом «Приоритет»…), а не режется и не прокручивается вбок.
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { people } from '$lib/api/people.svelte';
	import type { Pager } from '$lib/api/pager.svelte';
	import { DataTable, DateText, Money, TableCell, UserName, type Col, type SortState } from '$lib/ui';
		import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import { PRIORITY_LABELS } from '../../shared/labels';
	import { directionsLabel, hasProducts, productLine, productParts, productsTitle, type DealRow } from './dealProducts';
	import DealStatusChip from '../DealStatusChip.svelte';
	import { workflows } from '../workflows.svelte';

	interface Props {
		pager: Pager<R>;
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
		/** состояние заголовка сортируемой колонки; сортирует сам сервер (`GET /api/deals?sort=`) — таблица только просит и рисует стрелку */
		sort?: SortState | null;
		onSort?: (next: SortState | null) => void;
		/** «Найдено: N» — бэкенд отдаёт с 25.09 (backend-issues A-11); без него футер считает загруженное */
		total?: number;
	}

	let { pager, fill = false, selectable = false, selected = [], onSelect, actionBar, empty, compact = false, showOwner = false, embedded = false, sort = null, onSort, total }: Props = $props();

	const rows = $derived(pager.items);
	// колонки «Продукт» и «Направление» — только когда сервер прислал продукты в строке списка (`GET /api/deals`); у других ответов их нет
	const withProducts = $derived(!compact && hasProducts(rows));

	$effect(() => {
		people.ensure(pager.items.map((d) => d.owner_id));
		workflows.ensureMany(pager.items.map((d) => d.workflow_id));
	});

	// organization_name/contact_name — бэкенд отдаёт их прямо в DealOut (backend-issues A-29);
	// раньше здесь был N+1 через orgCache/contactCache только чтобы узнать то же самое.
	const party = (d: R): string => d.organization_name ?? d.contact_name ?? '';

	function open(row: R) {
		void goto(`/deals/${row.id}`);
	}
	// ссылка в ячейке работает и как обычная (в новой вкладке); обычный клик обрабатывает строка
	function link(e: MouseEvent) {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) e.stopPropagation();
		else e.preventDefault();
	}

	const fullColumns: Col<R>[] = $derived([
		{ key: 'number', title: 'Номер', render: numberCell, sortable: true },
		{ key: 'title', title: 'Сделка', width: 'minmax(160px, 3fr)', render: titleCell, sortable: true },
		{ key: 'party', title: 'Организация', width: 'minmax(140px, 2fr)', render: partyCell, drop: 3 },
		...(withProducts
			? [
					{ key: 'products', title: 'Продукт', width: 'minmax(110px, 1.6fr)', render: productsCell, drop: 2.5 },
					{ key: 'directions', title: 'Направление', width: 'minmax(100px, 1.2fr)', render: directionsCell, drop: 0.5 }
				]
			: []),
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'sla', title: 'Срок', hint: 'Срок (SLA): сколько сделка может пробыть в текущем статусе', render: slaCell, drop: 2 },
		{ key: 'amount', title: 'Сумма', align: 'right' as const, render: amountCell, sortable: true },
		...(showOwner ? [{ key: 'owner', title: 'Ответственный', render: ownerCell, drop: 4 }] : []),
		{ key: 'updated_at', title: 'Изменён', render: updatedCell, sortable: true, drop: 1 }
	]);
	const compactColumns: Col<R>[] = [
		{ key: 'title', title: 'Сделка', width: 'minmax(120px, 1fr)', render: compactTitleCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'amount', title: 'Сумма', align: 'right', render: amountCell }
	];
	const columns = $derived(compact ? compactColumns : fullColumns);
</script>

{#snippet numberCell(row: R)}
	<TableCell><a href="/deals/{row.id}" class="whitespace-nowrap text-fg" onclick={link}>{row.number}</a></TableCell>
{/snippet}
{#snippet titleCell(row: R)}
	<TableCell>
		{#if row.priority === 'high' || row.priority === 'critical'}<span class={['size-2 flex-none rounded-full', row.priority === 'critical' ? 'bg-danger' : 'bg-warning']} title={PRIORITY_LABELS[row.priority]} role="img" aria-label={PRIORITY_LABELS[row.priority]}></span>{/if}
		<span class="truncate font-medium" title={row.title}>{row.title}</span>
	</TableCell>
{/snippet}
{#snippet compactTitleCell(row: R)}
	<TableCell><a href="/deals/{row.id}" class="truncate font-medium text-fg" title="{row.number} · {row.title}" onclick={link}>{row.title}</a></TableCell>
{/snippet}
{#snippet partyCell(row: R)}<TableCell><span class="truncate">{party(row) || '—'}</span></TableCell>{/snippet}
{#snippet productsCell(row: R)}
	{@const parts = productParts(row)}
	<TableCell>
		<span class="min-w-0 truncate" title={productsTitle(row)}>{parts.first}</span>
		{#if parts.more > 0}<span class="flex-none text-muted" title={productsTitle(row)}>+{parts.more}</span>{/if}
	</TableCell>
{/snippet}
{#snippet directionsCell(row: R)}<TableCell><span class="truncate" title={directionsLabel(row)}>{directionsLabel(row)}</span></TableCell>{/snippet}
{#snippet statusCell(row: R)}<TableCell><DealStatusChip statusId={row.status_id} /></TableCell>{/snippet}
{#snippet slaCell(row: R)}<TableCell><SlaIndicator deal={row} compact /></TableCell>{/snippet}
{#snippet amountCell(row: R)}<TableCell align="right"><Money value={row.amount} currency={row.currency} /></TableCell>{/snippet}
{#snippet ownerCell(row: R)}<TableCell><span class="truncate"><UserName id={row.owner_id} /></span></TableCell>{/snippet}
{#snippet updatedCell(row: R)}<TableCell><span class="text-muted"><DateText value={row.updated_at} relative /></span></TableCell>{/snippet}

{#snippet card(row: R)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-center justify-between gap-2">
			<span class="t-desc-l flex-none whitespace-nowrap text-muted">{row.number}</span>
			<span class="flex min-w-0 justify-end overflow-hidden rounded-full"><DealStatusChip statusId={row.status_id} /></span>
		</div>
		<span class="t-row-strong break-words">{row.title}</span>
		<span class="t-desc-l truncate text-muted">{party(row)}</span>
		{#if productLine(row)}<span class="t-desc-l truncate text-muted" title={productsTitle(row)}>{productLine(row)}</span>{/if}
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
	onSort={(next) => onSort?.(next)}
	{total}
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
