<script lang="ts">
	// Сделки: таблица/карточки или доска. Все фильтры — в адресной строке; главное действие — «Новая сделка».
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { AddLarge, CloseSmall, Fold, GridColumns3, History, Refresh, Table, Unfold, UserAdd } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, FilterBar, IconBtn, Page, PageHeader, TabsBar, UserPicker } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import RecentList from '../recent/RecentList.svelte';
	import PopPanel from '../shared/PopPanel.svelte';
	import OrgPicker from '../shared/pickers/OrgPicker.svelte';
	import RangeField from '$lib/ui/fields/RangeField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { DEAL_TYPE_LABELS, PRIORITY_LABELS } from '../shared/labels';
	import { productFitsDirection, withDescendants } from '../shared/directions';
	import { directionItems, directions, products, regions } from '../shared/refs.svelte';
	import type { DealListItem } from '../types';
	import BulkReassignModal from './list/BulkReassignModal.svelte';
	import DealsBoard from './list/DealsBoard.svelte';
	import { defaultCollapse } from './list/boardColumns';
	import DealsTable from './list/DealsTable.svelte';
	import { formatTabCount, loadTabCounts, tabQueries, type TabCounts, type TabKey } from './list/dealCounts';
	import { activeCount, readFilters, sortToState, stateToSort, toQuery } from './list/dealFilters';
	import { statusName, steps, terminals } from './statusUtils';
	import NewDealDrawer from './new/NewDealDrawer.svelte';
	import { workflows } from './workflows.svelte';

	const f = $derived(readFilters(page.url.searchParams));
	const meId = $derived(session.me?.id);
	const canRead = $derived(session.can('deal:read'));
	const canCreate = $derived(session.can('deal:create'));
	const canBulk = $derived(session.can('deal:reassign_bulk'));
	const showOwner = $derived(session.can('deal:reassign'));
	const query = $derived(toQuery(f, meId));
	// на доске воронка выбрана всегда, поэтому в счётчик фильтров не входит
	// (на доске статусы не фильтруют, поэтому в счётчик не входят)
	const filterCount = $derived(activeCount(f, !showOwner) - (f.view === 'board' && f.workflow ? 1 : 0) - (f.view === 'board' && f.statuses.length ? 1 : 0));

	// числа на вкладках: те же фильтры, что у списка, но без быстрого фильтра (вкладки сравниваются между собой).
	// Пока новое число грузится, остаётся прежнее — без мигания нулей; до первого ответа вкладка без числа.
	let tabCounts = $state<TabCounts>({});
	let countsTick = $state(0);
	const baseQuery = $derived(toQuery({ ...f, quick: 'all', statuses: f.view === 'board' ? [] : f.statuses }, meId));
	$effect(() => {
		if (!canRead) return;
		const queries = tabQueries(baseQuery, meId);
		void countsTick;
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			const counts = await loadTabCounts(queries, ctrl.signal);
			if (!ctrl.signal.aborted) tabCounts = { ...tabCounts, ...counts };
		}, 300);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});
	const recount = () => (countsTick += 1);

	const pager = createPager<DealListItem>(async (cursor, signal) =>
		unwrap(api.GET('/api/deals', { params: { query: { ...query, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	let board = $state<{ reload: () => Promise<void> }>();
	// «Свернуть пустые столбцы» доски: пока не трогали, включено при более чем 8 столбцах (14 шагов и 3 терминальных статуса)
	let collapseChoice = $state<boolean | null>(null);
	const boardGraph = $derived(workflows.graph(f.workflow || undefined));
	const collapse = $derived(collapseChoice ?? defaultCollapse(boardGraph ? steps(boardGraph).length + terminals(boardGraph).length : 0));
	let selected = $state<string[]>([]);
	let bulkOpen = $state(false);
	let recentOpen = $state(false);
	let innerHeight = $state(900);

	onMount(() => {
		if (!session.can('deal:read')) return;
		void workflows.published.ensure().then((list) => workflows.ensureMany(list.map((w) => w.id))).catch(() => {});
		void regions.ensure().catch(() => {});
		void products.ensure().catch(() => {});
		void directions.ensure().catch(() => {});
	});

	$effect(() => {
		JSON.stringify(query);
		if (f.view === 'table' && canRead) untrack(() => ((selected = []), void pager.reload()));
	});

	// доске нужна воронка: берём основную для выбранного типа
	$effect(() => {
		if (f.view !== 'board' || f.workflow) return;
		const list = workflows.published.value;
		if (!list?.length) return;
		const wanted = f.type || 'b2b';
		const def = list.find((w) => w.is_default && w.deal_type === wanted) ?? list.find((w) => w.is_default) ?? list[0];
		void setQuery({ workflow: def.id });
	});

	const set = (patch: Record<string, string | string[] | null>) => setQuery(patch);
	/** ключи адресной строки, что сбрасывают фильтры (поиск и вкладка — отдельно); `new`, `org`, `contact` — форма создания, не фильтры */
	const FILTER_KEYS = ['workflow', 'status', 'organization', 'direction', 'type', 'priority', 'owner', 'region', 'product', 'from', 'to'];
	const cleared = Object.fromEntries(FILTER_KEYS.map((k) => [k, null]));
	const reset = () => setQuery(cleared);
	const refresh = () => {
		recount();
		return f.view === 'board' ? board?.reload() : pager.reload();
	};

	const publishedList = $derived(workflows.published.value ?? []);
	const boardFlowName = $derived(publishedList.find((w) => w.id === f.workflow)?.name ?? '…');
	const flowItems = $derived(publishedList.map((w) => ({ key: w.id, value: w.name, hint: DEAL_TYPE_LABELS[w.deal_type] })));
	const statusItems = $derived.by(() => {
		const list = f.workflow ? publishedList.filter((w) => w.id === f.workflow) : f.type ? publishedList.filter((w) => w.deal_type === f.type) : publishedList;
		return list.flatMap((w) =>
			(workflows.graph(w.id)?.statuses ?? [])
				.filter((s) => !s.is_archived)
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((s) => ({ key: s.id, value: statusName(s.name), hint: list.length > 1 ? DEAL_TYPE_LABELS[w.deal_type] : undefined }))
		);
	});
	const typeItems = Object.entries(DEAL_TYPE_LABELS).map(([key, value]) => ({ key, value }));
	const priorityItems = Object.entries(PRIORITY_LABELS).map(([key, value]) => ({ key, value }));
	const regionItems = $derived((regions.value ?? []).map((r) => ({ key: r.id, value: r.name })));
	const directionOpts = $derived(directionItems(directions.value));
	// список продуктов сужается по выбранному направлению (вместе с вложенными)
	const productItems = $derived.by(() => {
		const inDirection = f.direction && directions.value ? withDescendants(directions.value, f.direction) : null;
		return (products.value ?? []).filter((p) => !inDirection || (p.direction_id && inDirection.has(p.direction_id))).map((p) => ({ key: p.id, value: p.name }));
	});
	/** смена направления сбрасывает продукт, если он из другого направления */
	function setDirection(id: string | null) {
		const prod = products.value?.find((p) => p.id === f.product);
		const keep = !prod || productFitsDirection(directions.value ?? [], prod.direction_id, id);
		set({ direction: id, product: keep ? f.product || null : null });
	}

	const TAB_LABELS: [TabKey, string][] = [
		['all', 'Все'],
		['mine', 'Мои'],
		['warning', 'Под угрозой'],
		['breached', 'Просрочены'],
		['closed', 'Закрытые']
	];
	const quickTabs = $derived(TAB_LABELS.map(([key, label]) => ({ key, label, count: formatTabCount(tabCounts[key]) })));
	// фильтры, что живут в боковой панели «Фильтры»: тип, регион, продукт, период (и воронка в режиме таблицы)
	const moreActive = $derived([f.type, f.region, f.product, f.priority, showOwner ? f.owner : '', f.from || f.to, f.view === 'table' ? f.workflow : ''].filter(Boolean).length);

	// форма создания открывается ссылкой `?new=1` (и `&org=` / `&contact=` из карточек организации и контакта)
	const creating = $derived(page.url.searchParams.get('new') === '1' && canCreate);
	const prefill = $derived({ organizationId: page.url.searchParams.get('org'), contactId: page.url.searchParams.get('contact') });
	const openCreate = () => setQuery({ new: '1' }, { push: true });
	const closeCreate = () => setQuery({ new: null, org: null, contact: null });

	const tableFill = $derived(innerHeight >= 640);
	const bp = useBreakpoint();
</script>

<svelte:window bind:innerHeight />
<svelte:head><title>Сделки · RTK School</title></svelte:head>

{#snippet tableIcon()}<Table />{/snippet}
{#snippet boardIcon()}<GridColumns3 />{/snippet}

{#snippet actionBar()}
	<span class="t-body-m">Выбрано: {selected.length}</span>
	<Btn label="Передать другому" icon={UserAdd} size="s" onclick={() => (bulkOpen = true)} />
	<IconBtn icon={CloseSmall} label="Снять выбор" onclick={() => (selected = [])} />
{/snippet}

{#snippet emptyList()}
	{#if filterCount > 0 || f.q || f.quick !== 'all'}
		<EmptyState title="Ничего не найдено" compact>
			{#snippet action()}<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={() => setQuery({ q: null, quick: null, ...cleared })} />{/snippet}
		</EmptyState>
	{:else}
		<EmptyState title="Сделок пока нет" compact>
			{#snippet action()}{#if canCreate}<Btn label="Новая сделка" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={openCreate} />{/if}{/snippet}
		</EmptyState>
	{/if}
{/snippet}

<!-- «Обновить» и «Недавние» стоят в конце ряда фильтров: рядом с вкладками, которые теперь несут числа, им уже не хватает места -->
{#snippet viewSwitch()}
	<SegmentedControl value={f.view} size="m" onChange={(v) => setQuery({ view: v === 'board' ? 'board' : null })} aria-label="Вид списка">
		<Segment index="table" label={bp.isMobile ? undefined : 'Таблица'} icon={tableIcon} aria-label="Таблица" />
		<Segment index="board" label={bp.isMobile ? undefined : 'Доска'} icon={boardIcon} aria-label="Доска" />
	</SegmentedControl>
{/snippet}

{#snippet trailing()}
	<!-- a phone: the header row belongs to the tabs (all five must be seen), so the view is one button in the filter row: it shows what a tap switches to -->
	{#if bp.isMobile && canRead}
		<IconBtn icon={f.view === 'board' ? Table : GridColumns3} label={f.view === 'board' ? 'Показать таблицей' : 'Показать доской'} variant="secondary" onclick={() => setQuery({ view: f.view === 'board' ? null : 'board' })} data-testid="view-toggle" />
	{/if}
	{#if f.view === 'board' && f.workflow}
		<IconBtn icon={collapse ? Unfold : Fold} label={collapse ? 'Показать пустые столбцы' : 'Свернуть пустые столбцы'} variant={collapse ? 'secondary' : 'ghost'} aria-pressed={collapse} onclick={() => (collapseChoice = !collapse)} data-testid="board-collapse" />
	{/if}
	{#if !bp.isMobile}
		<!-- уже 1280 px ряд фильтров переносится, и две иконки остались бы одни на строке: на узких экранах не показываем -->
		<div class="flex items-center gap-2 max-xl:hidden">
		<IconBtn icon={Refresh} label="Обновить" onclick={refresh} />
		<PopPanel open={recentOpen} onClose={() => (recentOpen = false)} title="Недавно открытые">
			{#snippet trigger()}<IconBtn icon={History} label="Недавние" onclick={() => (recentOpen = !recentOpen)} aria-expanded={recentOpen} />{/snippet}
			<RecentList compact limit={8} />
		</PopPanel>
		</div>
	{/if}
{/snippet}

{#snippet filters()}
	<OrgPicker label="Вуз" value={f.organization || null} onChange={(id) => set({ organization: id })} />
	<Pick label="Направление" items={directionOpts} clearable search value={f.direction || null} placeholder="Все" onChange={setDirection} />
	{#if f.view === 'board'}
		<Pick label="Воронка" items={flowItems} clearable value={f.workflow || null} placeholder="Все" onChange={(v) => set({ workflow: v, status: null })} />
	{:else}
		<MultiPick label="Статус" items={statusItems} value={f.statuses} placeholder="Все" onChange={(v) => set({ status: v })} />
	{/if}
{/snippet}

{#snippet more()}
	{#if f.view === 'table'}
		<Pick label="Воронка" items={flowItems} clearable value={f.workflow || null} placeholder="Все" onChange={(v) => set({ workflow: v, status: null })} />
	{/if}
	<Pick label="Продукт" items={productItems} clearable search value={f.product || null} placeholder="Все" onChange={(v) => set({ product: v })} />
	{#if showOwner}
		<UserPicker label="Ответственный" roles={['KAM', 'HEAD']} value={f.owner || null} placeholder="Все" onChange={(id) => set({ owner: id })} />
	{/if}
	<Pick label="Приоритет" items={priorityItems} clearable value={f.priority || null} placeholder="Любой" onChange={(v) => set({ priority: v })} />
	<Pick label="Тип" items={typeItems} clearable value={f.type || null} placeholder="Все" onChange={(v) => set({ type: v, status: null })} />
	<Pick label="Регион" items={regionItems} clearable search value={f.region || null} placeholder="Все" onChange={(v) => set({ region: v })} />
	<RangeField label="Создана" from={f.from} to={f.to} onChange={(from, to) => set({ from: from || null, to: to || null })} />
{/snippet}

<Page fill={tableFill}>
	<PageHeader title="Сделки" primary={canCreate ? { label: 'Новая сделка', onclick: openCreate, testid: 'new-deal' } : undefined}>
		{#snippet tabs(underline)}
			{#if canRead}<TabsBar items={quickTabs} value={f.quick} onChange={(key) => set({ quick: key === 'all' ? null : key })} label="Какие сделки показывать" {underline} />{/if}
		{/snippet}
		{#snippet actions()}
			{#if canRead && !bp.isMobile}
				{@render viewSwitch()}
			{/if}
		{/snippet}
	</PageHeader>

	{#if !canRead}
		<EmptyState title="Нет доступа к сделкам" compact />
	{:else}
		<FilterBar search={f.q} placeholder="Номер, название или вуз" onSearch={(v) => set({ q: v || null })} active={filterCount} onReset={reset} {filters} {more} {moreActive} {trailing} />

		{#if f.view === 'board'}
			{#if f.workflow}
				<p class="t-desc-l m-0 -mt-1 text-muted">Доска показывает одну воронку — «{boardFlowName}», числа на вкладках считаются по ней. Другую выберите в фильтре «Воронка».</p>
				<DealsBoard bind:this={board} workflowId={f.workflow} {query} {collapse} onChange={recount} filtered={filterCount > 0 || !!f.q || f.quick !== 'all'} onReset={() => setQuery({ q: null, quick: null, ...cleared, workflow: f.workflow })} onCreate={canCreate ? openCreate : undefined} />
			{/if}
		{:else}
			<DealsTable
					{pager}
					fill={tableFill}
					{showOwner}
					selectable={canBulk}
					{selected}
					onSelect={(keys) => (selected = keys)}
					{actionBar}
					empty={emptyList}
					sort={sortToState(f.sort)}
					onSort={(next) => set({ sort: stateToSort(next) || null })}
					total={pager.total}
				/>
		{/if}
	{/if}
</Page>

<NewDealDrawer open={creating} onClose={closeCreate} {prefill} />
<BulkReassignModal
	open={bulkOpen}
	dealIds={selected}
	onClose={() => (bulkOpen = false)}
	onDone={() => {
		bulkOpen = false;
		selected = [];
		void refresh();
	}}
/>
