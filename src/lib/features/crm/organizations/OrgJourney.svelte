<script lang="ts">
	// Вкладка «Путь» организации (раздел 3 задания: цикл взаимодействия с каждым вузом по всем ИТ-программам и ИТ-продуктам):
	// дорожка на продукт, в ней лента шагов каждой сделки (как в карточке сделки: пропущенный шаг, возврат), ниже — общая хронология переходов.
	// Ручки «весь путь вуза одним запросом» в API нет, поэтому историю берём по сделкам вуза: не больше 20, по 6 одновременно.
	import { onMount, untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { DateText, EmptyState, ErrorState, FilterBar, Notice, Skeleton, StatusChip, StatusSteps } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import RangeField from '$lib/ui/fields/RangeField.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { runLimited } from '../deals/list/boardColumns';
	import type { DealRow } from '../deals/list/dealProducts';
	import DealStatusChip from '../deals/DealStatusChip.svelte';
	import { workflows } from '../deals/workflows.svelte';
	import { plural } from '$lib/utils/format';
	import type { DealHistory } from '../types';
	import { NO_PRODUCT, filterDeals, groupByProduct, journeyEvents, ribbon, type EventKind } from './journey';

	let { orgId }: { orgId: string } = $props();

	const HISTORY_LIMIT = 20;
	const PARALLEL = 6;
	const EVENTS_PAGE = 30;

	let deals = $state<DealRow[]>([]);
	let total = $state(0);
	let histories = $state<Record<string, DealHistory>>({});
	let loading = $state(true);
	let error = $state<unknown>(null);
	let shownEvents = $state(EVENTS_PAGE);
	let seq = 0;

	async function load() {
		const mine = ++seq;
		loading = true;
		error = null;
		histories = {};
		try {
			const page = await unwrap(api.GET('/api/deals', { params: { query: { organization_id: [orgId], limit: 100 } } }));
			if (mine !== seq) return;
			deals = page.items;
			total = page.total ?? page.items.length;
			await Promise.all([...new Set(page.items.map((d) => d.workflow_id))].map((id) => workflows.ensure(id).catch(() => undefined)));
			if (mine !== seq) return;
			loading = false;
			await runLimited(
				page.items.slice(0, HISTORY_LIMIT).map((d) => async () => {
					try {
						const h = await unwrap(api.GET('/api/deals/{deal_id}/history', { params: { path: { deal_id: d.id } } }));
						if (mine === seq) histories[d.id] = h;
					} catch {
						// история одной сделки не пришла: её лента рисуется без пропусков, в хронологии её нет
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
	onMount(() => untrack(() => void load()));

	// фильтры — в адресе
	const product = $derived(readQuery('product'));
	const direction = $derived(readQuery('direction'));
	const from = $derived(readQuery('from'));
	const to = $derived(readQuery('to'));
	const filterCount = $derived([product, direction, from || to].filter(Boolean).length);

	const productItems = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const d of deals) for (const p of d.products ?? []) seen.set(p.product_id, p.product_name);
		const items = [...seen].sort((a, b) => a[1].localeCompare(b[1], 'ru')).map(([key, value]) => ({ key, value }));
		return deals.some((d) => !(d.products ?? []).length) ? [...items, { key: NO_PRODUCT, value: 'Без продукта' }] : items;
	});
	const directionItems = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const d of deals) for (const x of d.directions ?? []) seen.set(x.id, x.name);
		return [...seen].sort((a, b) => a[1].localeCompare(b[1], 'ru')).map(([key, value]) => ({ key, value }));
	});

	const visible = $derived(filterDeals(deals, { product, direction }));
	const lanes = $derived(groupByProduct(visible).filter((l) => !product || l.key === product));
	const events = $derived(
		journeyEvents(
			visible.map((deal) => ({ deal, history: histories[deal.id] ?? null, graph: workflows.graph(deal.workflow_id) })),
			{ from, to }
		)
	);
	const loadedHistories = $derived(Object.keys(histories).length);

	$effect(() => {
		people.ensure(events.map((e) => e.by));
	});

	const reset = () => setQuery({ product: null, direction: null, from: null, to: null });

	const KIND: Record<EventKind, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'error' }> = {
		created: { label: 'Сделка создана', tone: 'neutral' },
		forward: { label: 'Вперёд', tone: 'neutral' },
		skip: { label: 'Через шаг', tone: 'info' },
		back: { label: 'Возврат', tone: 'warning' },
		resume: { label: 'Возобновлена', tone: 'info' },
		won: { label: 'Успешно закрыта', tone: 'success' },
		lost: { label: 'Отказ', tone: 'error' },
		parked: { label: 'Заморожена', tone: 'warning' }
	};
</script>

{#snippet filters()}
	<Pick label="Продукт" items={productItems} clearable value={product || null} placeholder="Все" onChange={(v) => setQuery({ product: v })} />
	<Pick label="Направление" items={directionItems} clearable value={direction || null} placeholder="Все" onChange={(v) => setQuery({ direction: v })} />
	<RangeField label="Период переходов" {from} {to} onChange={(a, b) => setQuery({ from: a || null, to: b || null })} />
{/snippet}

<div class="flex min-w-0 flex-col gap-4">
	{#if loading}
		<Skeleton kind="rows" rows={3} />
		<Skeleton kind="rows" rows={5} />
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if deals.length === 0}
		<EmptyState title="У вуза пока нет сделок" compact />
	{:else}
		<FilterBar active={filterCount} onReset={reset} {filters} />

		{#if total > deals.length || deals.length > HISTORY_LIMIT}
			<Notice class="shrink-0" tone="info">
				{#if total > deals.length}Показаны {deals.length} из {total} {plural(total, ['сделки', 'сделок', 'сделок'])}. {/if}История переходов загружена по {Math.min(deals.length, HISTORY_LIMIT)} из {deals.length}: ленты остальных сделок — без пропусков, в хронологии их нет.
			</Notice>
		{/if}

		{#if visible.length === 0}
			<EmptyState title="Ничего не найдено" compact />
		{:else}
			<div class="flex min-w-0 flex-col gap-4" data-testid="journey-lanes">
				{#each lanes as lane (lane.key)}
					<Card title={`${lane.name} · ${lane.deals.length}`}>
						<ul class="m-0 flex list-none flex-col gap-5 p-0">
							{#each lane.deals as deal (deal.id)}
								<li class="flex min-w-0 flex-col gap-2" data-testid="journey-deal">
									<div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
										<a class="t-body-m-strong min-w-0 text-fg" href="/deals/{deal.id}">{deal.number} · {deal.title}</a>
										<DealStatusChip statusId={deal.status_id} />
									</div>
									<StatusSteps steps={ribbon(workflows.graph(deal.workflow_id), deal, histories[deal.id] ?? null)} label={`Шаги сделки ${deal.number}`} />
								</li>
							{/each}
						</ul>
					</Card>
				{/each}
			</div>

			<Card title={`Хронология · ${events.length}`}>
				{#if events.length === 0}
					<EmptyState title={loadedHistories ? 'Переходов за выбранный период нет' : 'История загружается…'} compact />
				{:else}
					<ol class="m-0 flex list-none flex-col gap-3 p-0" data-testid="journey-events">
						{#each events.slice(0, shownEvents) as e (e.id)}
							<li class="flex min-w-0 flex-col gap-1 border-l-2 border-line pl-3">
								<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
									<DateText value={e.at} time />
									<a class="t-body-s text-fg" href="/deals/{e.dealId}">{e.number}</a>
									{#if e.kind !== 'forward' && e.kind !== 'won' && e.kind !== 'lost' && e.kind !== 'parked'}<StatusChip label={KIND[e.kind].label} tone={KIND[e.kind].tone} />{/if}
									<span class="flex max-w-full min-w-0"><DealStatusChip statusId={e.toStatusId} /></span>
								</div>
								<div class="t-desc-l flex flex-wrap gap-x-3 text-muted">
									<span>{e.by ? people.name(e.by) : 'Система'}</span>
									{#if e.skipped.length}<span>Пропущен: {e.skipped.join(', ')}</span>{/if}
									{#if e.filesCount > 0}<span>Приложено файлов: {e.filesCount}</span>{/if}
								</div>
								{#if e.comment}<p class="t-body-m m-0 break-words">{e.comment}</p>{/if}
							</li>
						{/each}
					</ol>
					{#if events.length > shownEvents}
						<button type="button" class="t-body-s mt-3 cursor-pointer border-0 bg-transparent p-0 text-accent" onclick={() => (shownEvents += EVENTS_PAGE)}>Показать ещё</button>
					{/if}
				{/if}
			</Card>
		{/if}
	{/if}
</div>
