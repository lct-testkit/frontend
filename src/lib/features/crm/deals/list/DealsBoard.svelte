<script lang="ts">
	// Доска сделок по статусам воронки. У каждого столбца свой запрос `GET /deals?workflow_id=…&status_id=<столбец>&limit=25`
	// (не больше 6 одновременно): число в шапке — `total` ответа, а не число загруженных карточек; под списком «Ещё N» подгружает
	// следующие 25 по курсору этого столбца. Перетаскивание карточки в другую колонку открывает тот же диалог перехода, что и в карточке
	// сделки; после успешного перехода счётчики обоих столбцов сразу меняются на 1 и затем перечитываются с сервера.
	// Телефон — горизонтальная лента колонок со «снапом».
	import { Counter } from '@lct-testkit/rt-ui';
	import { people } from '$lib/api/people.svelte';
	import { api, unwrap } from '$lib/api';
	import { Avatar, Btn, EmptyState, ErrorState, Money, Skeleton, toast } from '$lib/ui';
	import PriorityChip from '../../shared/PriorityChip.svelte';
	import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import type { AvailableTransition, Deal, WorkflowStatus } from '../../types';
	import { COLUMN_PAGE, applyMove, emptyColumn, mergeItems, remaining, runLimited, withTotals, type BoardColumn } from './boardColumns';
	import { productLine, productsTitle, type DealRow } from './dealProducts';
	import TransitionDialog from '../card/TransitionDialog.svelte';
	import { isTerminal, statusName, statusTone, steps, terminals, type StatusTone } from '../statusUtils';
	import { workflows } from '../workflows.svelte';
	import type { DealQuery } from './dealFilters';

	interface Props {
		workflowId: string;
		query: DealQuery;
		/** сделка переехала в другой статус: родитель может пересчитать числа на вкладках */
		onChange?: () => void;
	}

	let { workflowId, query, onChange }: Props = $props();

	const PARALLEL = 6;
	let cols = $state<Record<string, BoardColumn>>({});
	let loading = $state(true);
	let error = $state<unknown>(null);
	let seq = 0;

	const graph = $derived(workflows.graph(workflowId));
	const columns = $derived([...steps(graph), ...terminals(graph)]);
	const allDeals = $derived(Object.values(cols).flatMap((c) => c.items));

	// статусы доска не фильтрует (у каждого столбца свой), остальные фильтры — общие
	const base = (statusId: string) => ({ ...query, status_id: [statusId], workflow_id: workflowId });

	async function fetchColumn(statusId: string, cursor?: string, limit = COLUMN_PAGE) {
		return unwrap(api.GET('/api/deals', { params: { query: { ...base(statusId), limit, cursor } } }));
	}

	export async function reload(): Promise<void> {
		const mine = ++seq;
		loading = true;
		error = null;
		try {
			await workflows.ensure(workflowId);
			const g = workflows.graph(workflowId);
			const list = [...steps(g), ...terminals(g)];
			if (mine !== seq) return;
			cols = Object.fromEntries(list.map((st) => [st.id, emptyColumn()]));
			loading = false;
			await runLimited(
				list.map((st) => async () => {
					try {
						const page = await fetchColumn(st.id);
						if (mine === seq) cols[st.id] = { ...emptyColumn(), loading: false, items: page.items, total: page.total ?? page.items.length, cursor: page.next_cursor ?? null };
					} catch (e) {
						if (mine === seq) cols[st.id] = { ...emptyColumn(), loading: false, error: e };
					}
				}),
				PARALLEL
			);
		} catch (e) {
			if (mine === seq) {
				error = e;
				loading = false;
			}
		}
	}

	async function reloadColumn(statusId: string) {
		const mine = seq;
		cols[statusId] = { ...emptyColumn(), items: cols[statusId]?.items ?? [], total: cols[statusId]?.total ?? null };
		try {
			const page = await fetchColumn(statusId);
			if (mine === seq) cols[statusId] = { ...emptyColumn(), loading: false, items: page.items, total: page.total ?? page.items.length, cursor: page.next_cursor ?? null };
		} catch (e) {
			if (mine === seq) cols[statusId] = { ...emptyColumn(), loading: false, error: e };
		}
	}

	async function loadMore(statusId: string) {
		const col = cols[statusId];
		if (!col?.cursor || col.loadingMore) return;
		const mine = seq;
		col.loadingMore = true;
		try {
			const page = await fetchColumn(statusId, col.cursor);
			if (mine !== seq) return;
			const items = mergeItems(col.items, page.items);
			cols[statusId] = { ...col, items, total: page.total ?? col.total, cursor: page.next_cursor ?? null, loadingMore: false };
		} catch (e) {
			col.loadingMore = false;
			toast.error(e, 'Не удалось подгрузить сделки');
		}
	}

	$effect(() => {
		JSON.stringify(query);
		void workflowId;
		void reload();
	});

	$effect(() => {
		people.ensure(allDeals.map((d) => d.owner_id));
	});

	const TOP: Record<StatusTone, string> = {
		neutral: 'border-t-neutral',
		accent: 'border-t-accent',
		info: 'border-t-info',
		success: 'border-t-success',
		warning: 'border-t-warning',
		error: 'border-t-danger'
	};

	// organization_name/contact_name — бэкенд отдаёт их прямо в DealOut (backend-issues A-29);
	// раньше здесь был N+1 через orgCache/contactCache только чтобы узнать то же самое.
	const party = (d: DealRow) => d.organization_name ?? d.contact_name ?? '';

	// --- перетаскивание -> диалог перехода
	let dragId = $state<string | null>(null);
	let overStatus = $state<string | null>(null);
	let dialog = $state<{ deal: DealRow; transition: AvailableTransition } | null>(null);

	async function drop(target: WorkflowStatus) {
		const deal = allDeals.find((d) => d.id === dragId);
		dragId = null;
		overStatus = null;
		if (!deal || deal.status_id === target.id) return;
		try {
			const { items } = await unwrap(api.GET('/api/deals/{deal_id}/available-transitions', { params: { path: { deal_id: deal.id } } }));
			const transition = items.find((t) => t.to_status_id === target.id);
			if (!transition) toast.warning(`Из этого статуса нельзя перейти в «${target.name}»`);
			else dialog = { deal, transition };
		} catch (e) {
			toast.error(e, 'Не удалось проверить переход');
		}
	}

	// Переход прошёл: счётчики обоих столбцов сразу меняются на 1 (карточка встаёт первой в целевом), затем числа перечитываются с сервера.
	// Диалог перехода открывается до отправки, поэтому при отказе сервера ничего менять не приходится — карточка остаётся в своём столбце.
	async function moved(updated: Deal) {
		const old = allDeals.find((d) => d.id === updated.id);
		dialog = null;
		if (!old) return;
		const from = old.status_id;
		const to = updated.status_id;
		cols = applyMove(cols, { ...old, ...updated }, from, to);
		onChange?.();
		const fresh = await Promise.all(
			[from, to].map(async (id) => {
				try {
					return [id, (await fetchColumn(id, undefined, 1)).total] as const;
				} catch {
					return [id, undefined] as const;
				}
			})
		);
		cols = withTotals(cols, Object.fromEntries(fresh));
	}
</script>

{#snippet dealCard(deal: DealRow)}
	<a
		href="/deals/{deal.id}"
		draggable="true"
		class={[
			'flex min-w-0 cursor-grab flex-col gap-1.5 rounded-md border border-line bg-surface p-3 text-fg no-underline shadow-s transition hover:border-accent hover:no-underline active:cursor-grabbing',
			dragId === deal.id && 'opacity-40'
		]}
		ondragstart={(e) => {
			dragId = deal.id;
			e.dataTransfer?.setData('text/plain', deal.id);
		}}
		ondragend={() => {
			dragId = null;
			overStatus = null;
		}}
	>
		<span class="flex items-center justify-between gap-2">
			<span class="t-desc-l text-muted">{deal.number}</span>
			<PriorityChip priority={deal.priority} hideNormal />
		</span>
		<span class="t-body-m-strong line-clamp-2 break-words">{deal.title}</span>
		<span class="t-desc-l truncate text-muted">{party(deal)}</span>
		{#if productLine(deal)}<span class="t-desc-l line-clamp-1 text-muted" title={productsTitle(deal)}>{productLine(deal)}</span>{/if}
		<span class="flex min-w-0 items-center justify-between gap-2">
			<span class="t-body-s-strong min-w-0 truncate"><Money value={deal.amount} currency={deal.currency} short /></span>
			<span class="min-w-0 flex-none"><SlaIndicator {deal} compact /></span>
		</span>
		<span class="t-desc-l flex items-center gap-1.5 text-muted">
			<Avatar name={people.name(deal.owner_id)} size={24} />
			<span class="truncate">{people.name(deal.owner_id)}</span>
		</span>
	</a>
{/snippet}

{#if error}
	<ErrorState {error} onRetry={reload} />
{:else if loading}
	<div class="flex gap-3 overflow-hidden">
		<div class="w-72 flex-none"><Skeleton kind="tile" rows={4} height={88} /></div>
		<div class="w-72 flex-none max-md:hidden"><Skeleton kind="tile" rows={3} height={88} /></div>
	</div>
{:else if !graph}
	<EmptyState title="Воронка не найдена" compact />
{:else}
	<div class="-mx-3 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-3 pb-3 md:mx-0 md:min-h-0 md:flex-1 md:snap-none md:items-stretch md:px-0" aria-busy={Object.values(cols).some((c) => c.loading) || undefined}>
		{#each columns as status (status.id)}
			{@const col = cols[status.id] ?? emptyColumn()}
			{@const more = remaining(col)}
			{@const tone = statusTone(status.type)}
			<section
				class={[
					'flex w-[86vw] max-w-80 flex-none snap-center flex-col rounded-lg border border-t-[3px] border-line bg-surface-2 md:min-h-0 md:w-72',
					TOP[tone],
					overStatus === status.id && dragId && 'ring-2 ring-accent'
				]}
				style:border-top-color={status.color ?? undefined}
				ondragover={(e) => {
					if (dragId) {
						e.preventDefault();
						overStatus = status.id;
					}
				}}
				ondragleave={() => (overStatus = overStatus === status.id ? null : overStatus)}
				ondrop={(e) => {
					e.preventDefault();
					void drop(status);
				}}
				aria-label={statusName(status.name)}
			>
				<header class="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
					<h3 class="t-body-s-strong m-0 truncate" title={statusName(status.name)}>{statusName(status.name)}</h3>
					{#if col.total !== null}<Counter size="xs" variant="ghost" colorScheme="neutral">{col.total}</Counter>{/if}
				</header>
				<div class={['flex min-h-16 flex-col gap-2 overflow-y-auto p-2 pt-1 max-md:max-h-[62dvh] md:min-h-0 md:flex-1', isTerminal(status) && 'opacity-90']}>
					{#if col.loading && !col.items.length}
						<Skeleton kind="tile" rows={2} height={88} />
					{:else if col.error && !col.items.length}
						<div class="flex flex-col items-center gap-2 py-3 text-center">
							<p class="t-desc-l m-0 text-soft">Не удалось загрузить</p>
							<Btn label="Повторить" size="s" variant="outline" colorScheme="neutral" onclick={() => reloadColumn(status.id)} />
						</div>
					{:else}
						{#each col.items as deal (deal.id)}{@render dealCard(deal)}{:else}
							<p class="t-desc-l m-0 py-3 text-center text-soft">Пусто</p>
						{/each}
						{#if more > 0}
							<Btn label={`Ещё ${more}`} size="s" variant="outline" colorScheme="neutral" block loading={col.loadingMore} onclick={() => loadMore(status.id)} data-testid="board-more" />
						{/if}
					{/if}
				</div>
			</section>
		{/each}
	</div>
{/if}

{#if dialog}
	<TransitionDialog open deal={dialog.deal} transition={dialog.transition} {graph} onClose={() => (dialog = null)} onDone={(updated) => void moved(updated)} />
{/if}
