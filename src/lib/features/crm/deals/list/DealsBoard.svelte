<script lang="ts">
	// Доска сделок по статусам воронки. У каждого столбца свой запрос `GET /deals?workflow_id=…&status_id=<столбец>&limit=25`
	// (не больше 6 одновременно): число в шапке — `total` ответа, а не число загруженных карточек; под списком «Ещё N» подгружает
	// следующие 25 по курсору этого столбца. Перетаскивание карточки в другую колонку открывает тот же диалог перехода, что и в карточке
	// сделки; после успешного перехода счётчики обоих столбцов сразу меняются на 1 и затем перечитываются с сервера.
	// Телефон — горизонтальная лента колонок со «снапом».
	import { Counter, DropdownMenu } from '@lct-testkit/rt-ui';
	import { session } from '$lib/auth/session.svelte';
	import { people } from '$lib/api/people.svelte';
	import { api, unwrap } from '$lib/api';
	import { AddLarge, MenuKebab } from '@lct-testkit/rt-ui/icons';
	import { Avatar, Btn, EmptyState, ErrorState, IconBtn, Money, Skeleton, toast } from '$lib/ui';
	import PriorityChip from '../../shared/PriorityChip.svelte';
	import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import type { AvailableTransition, Deal, WorkflowStatus } from '../../types';
	import { COLUMN_PAGE, applyMove, emptyColumn, isFolded, mergeItems, remaining, runLimited, withTotals, type BoardColumn } from './boardColumns';
	import { productLine, productsTitle, type DealRow } from './dealProducts';
	import TransitionDialog from '../card/TransitionDialog.svelte';
	import { isTerminal, moveMenuItems, roleHint, statusName, statusTone, steps, terminals, type StatusTone } from '../statusUtils';
	import { createTransitionsCache, dropVerdict, type DropVerdict } from './boardDrop';
	import { workflows } from '../workflows.svelte';
	import type { DealQuery } from './dealFilters';

	interface Props {
		workflowId: string;
		query: DealQuery;
		/** пустые столбцы свернуты в узкую полосу 44 px (название вертикально, счётчик); бросок на полосу работает как на столбец */
		collapse?: boolean;
		/** сделка переехала в другой статус: родитель может пересчитать числа на вкладках */
		onChange?: () => void;
		/** a search, a tab or a filter is on: an empty board offers to reset them */
		filtered?: boolean;
		onReset?: () => void;
		onCreate?: () => void;
		/** название воронки доски и воронки, где сделки есть: пустая доска называет воронку и предлагает перейти туда, где сделки */
		flowName?: string;
		otherFlows?: { id: string; name: string; count: number }[];
		onPickFlow?: (id: string) => void;
	}

	let { workflowId, query, collapse = false, onChange, filtered = false, onReset, onCreate, flowName, otherFlows = [], onPickFlow }: Props = $props();

	const PARALLEL = 6;
	let cols = $state<Record<string, BoardColumn>>({});
	let loading = $state(true);
	let error = $state<unknown>(null);
	let seq = 0;

	const graph = $derived(workflows.graph(workflowId));
	const columns = $derived([...steps(graph), ...terminals(graph)]);
	const allDeals = $derived(Object.values(cols).flatMap((c) => c.items));
	/** every column answered and none has a deal: sixteen thin strips with «0» tell nothing — say it in words */
	const allEmpty = $derived(columns.length > 0 && columns.every((c) => cols[c.id] && !cols[c.id].loading && !cols[c.id].error && cols[c.id].items.length === 0 && !(cols[c.id].total && cols[c.id].total! > 0)));

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

	// Доступные переходы перетаскиваемой сделки: один запрос на dragstart (кэш на 30 с), по ним у недоступных столбцов гасится подсветка.
	const transitionsCache = createTransitionsCache();
	const inflight = new Map<string, Promise<AvailableTransition[]>>();
	let verdicts = $state<Record<string, DropVerdict> | null>(null);

	async function transitionsOf(dealId: string): Promise<AvailableTransition[]> {
		const cached = transitionsCache.get(dealId);
		if (cached) return cached;
		// dragstart и drop могут прийти раньше ответа: делят один запрос
		let pending = inflight.get(dealId);
		if (!pending) {
			pending = unwrap(api.GET('/api/deals/{deal_id}/available-transitions', { params: { path: { deal_id: dealId } } }))
				.then(({ items }) => {
					transitionsCache.set(dealId, items);
					return items;
				})
				.finally(() => inflight.delete(dealId));
			inflight.set(dealId, pending);
		}
		return pending;
	}

	async function startDrag(deal: DealRow) {
		verdicts = null;
		try {
			const items = await transitionsOf(deal.id);
			if (dragId === deal.id) verdicts = Object.fromEntries(columns.map((c) => [c.id, dropVerdict(items, c.id)]));
		} catch {
			// не успели или нет сети: подсветка работает как раньше, а drop() проверит переход сам
		}
	}

	/** столбец, в который эту карточку отпустить нельзя (свой столбец не гасим) */
	const blocked = (statusId: string): boolean => !!dragId && !!verdicts && verdicts[statusId] !== 'ok' && allDeals.find((d) => d.id === dragId)?.status_id !== statusId;

	async function drop(target: WorkflowStatus) {
		const deal = allDeals.find((d) => d.id === dragId);
		dragId = null;
		overStatus = null;
		verdicts = null;
		if (!deal || deal.status_id === target.id) return;
		try {
			const items = await transitionsOf(deal.id);
			const transition = items.find((t) => t.to_status_id === target.id && t.role_allowed) ?? items.find((t) => t.to_status_id === target.id);
			if (!transition) toast.warning(`Из этого статуса нельзя перейти в «${target.name}»`);
			else if (!transition.role_allowed) {
				const who = roleHint(transition, graph);
				toast.warning('Недоступно вашей роли', who ? `Только: ${who}` : undefined);
			} else dialog = { deal, transition };
		} catch (e) {
			toast.error(e, 'Не удалось проверить переход');
		}
	}

	// the same move without dragging: a button on the card (keyboard and phone; WCAG 2.1.1 and 2.5.7). One request, only on the click.
	const canMove = $derived(session.can('deal:transition'));
	let menuFor = $state<string | null>(null);
	let menuItems = $state<ReturnType<typeof moveMenuItems>>([]);
	let menuTransitions: AvailableTransition[] = [];
	let menuBusy = false;

	async function openMenu(deal: DealRow) {
		if (menuFor === deal.id) {
			menuFor = null;
			return;
		}
		if (menuBusy) return;
		menuBusy = true;
		try {
			menuTransitions = await transitionsOf(deal.id);
			menuItems = moveMenuItems(menuTransitions, (id) => workflows.status(id));
			if (menuItems.length) menuFor = deal.id;
			else toast.info('Из этого статуса переходов нет');
		} catch (e) {
			toast.error(e, 'Не удалось получить переходы');
		} finally {
			menuBusy = false;
		}
	}

	function pickMove(deal: DealRow, item: { key: string | number }) {
		menuFor = null;
		const transition = menuTransitions.find((t) => t.id === item.key);
		if (transition) dialog = { deal, transition };
	}

	// Переход прошёл: счётчики обоих столбцов сразу меняются на 1 (карточка встаёт первой в целевом), затем числа перечитываются с сервера.
	// Диалог перехода открывается до отправки, поэтому при отказе сервера ничего менять не приходится — карточка остаётся в своём столбце.
	async function moved(updated: Deal) {
		const old = allDeals.find((d) => d.id === updated.id);
		dialog = null;
		transitionsCache.delete(updated.id);
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
	<div class="relative">
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
			void startDrag(deal);
		}}
		ondragend={() => {
			dragId = null;
			overStatus = null;
			verdicts = null;
		}}
	>
		<span class={['flex items-center justify-between gap-2', canMove && 'pr-8']}>
			<span class="t-desc-l text-muted">{deal.number}</span>
			<PriorityChip priority={deal.priority} hideNormal />
		</span>
		<span class="t-body-m-strong line-clamp-2 break-words" title={deal.title}>{deal.title}</span>
		<span class="t-desc-l truncate text-muted" title={party(deal)}>{party(deal)}</span>
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
	{#if canMove}
		<div class="absolute top-1 right-1">
			<DropdownMenu class="w-auto flex-none" items={menuItems} isOpened={menuFor === deal.id} placement="bottomRight" onClose={() => (menuFor = null)} onClickItem={(item: { key: string | number }) => pickMove(deal, item)}>
				<IconBtn icon={MenuKebab} size="s" label="Перевести сделку {deal.number} в другой статус" aria-haspopup="menu" aria-expanded={menuFor === deal.id} onclick={() => void openMenu(deal)} data-testid="board-move" />
			</DropdownMenu>
		</div>
	{/if}
	</div>
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
{:else if allEmpty}
	<EmptyState
		title={filtered ? 'Сделок по этим условиям нет' : flowName ? `В воронке «${flowName}» сделок нет` : 'В этой воронке пока нет сделок'}
		hint={!filtered && otherFlows.length && onPickFlow ? 'Доска показывает одну воронку. Сделки есть в других — откройте нужную:' : undefined}
		compact
	>
		{#snippet action()}
			{#if filtered && onReset}
				<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={onReset} />
			{:else if otherFlows.length && onPickFlow}
				<div class="flex flex-wrap justify-center gap-2">
					{#each otherFlows as flow (flow.id)}<Btn label="{flow.name} · {flow.count}" variant="outline" colorScheme="neutral" onclick={() => onPickFlow(flow.id)} />{/each}
				</div>
			{:else if onCreate}
				<Btn label="Новая сделка" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={onCreate} />
			{/if}
		{/snippet}
	</EmptyState>
{:else}
	<div class="-mx-3 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-3 pb-3 md:mx-0 md:min-h-0 md:flex-1 md:snap-none md:items-stretch md:px-0" aria-busy={Object.values(cols).some((c) => c.loading) || undefined}>
		{#each columns as status (status.id)}
			{@const col = cols[status.id] ?? emptyColumn()}
			{@const more = remaining(col)}
			{@const tone = statusTone(status.type)}
			{@const folded = isFolded(collapse, col)}
			<section
				class={[
					'flex flex-none snap-center flex-col rounded-lg border border-t-[3px] border-line bg-surface-2 md:min-h-0',
					folded ? 'w-11' : 'w-[86vw] max-w-80 md:w-72',
					TOP[tone],
					overStatus === status.id && dragId && 'ring-2 ring-accent',
					blocked(status.id) && 'opacity-50'
				]}
				style:border-top-color={status.color ?? undefined}
				ondragover={(e) => {
					if (!dragId) return;
					const verdict = verdicts?.[status.id];
					// нет перехода вовсе — курсор «нельзя»; запрещён роли — отпустить можно (чтобы объяснить причину), но столбец не подсвечивается
					if (blocked(status.id) && verdict === 'none') {
						if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
						return;
					}
					e.preventDefault();
					overStatus = blocked(status.id) ? null : status.id;
				}}
				ondragleave={() => (overStatus = overStatus === status.id ? null : overStatus)}
				ondrop={(e) => {
					e.preventDefault();
					void drop(status);
				}}
				aria-label={statusName(status.name)}
			>
				{#if folded}
					<div class="flex min-h-0 flex-1 flex-col items-center gap-2 px-1 py-2.5" title="{statusName(status.name)}: пусто">
						<Counter size="xs" variant="ghost" colorScheme="neutral">{col.total}</Counter>
						<h3 class="t-body-s-strong m-0 min-h-0 flex-1 overflow-hidden text-muted [text-orientation:mixed] [writing-mode:vertical-rl] [text-overflow:ellipsis] whitespace-nowrap">{statusName(status.name)}</h3>
					</div>
				{:else}
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
				{/if}
			</section>
		{/each}
	</div>
{/if}

{#if dialog}
	<TransitionDialog open deal={dialog.deal} transition={dialog.transition} {graph} onClose={() => (dialog = null)} onDone={(updated) => void moved(updated)} />
{/if}
