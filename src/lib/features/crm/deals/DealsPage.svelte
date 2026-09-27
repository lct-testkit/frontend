<script lang="ts">
	// Сделки: таблица/карточки или доска. Все фильтры — в адресной строке; главное действие — «Новая сделка».
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { AddLarge, CloseSmall, GridColumns3, History, Refresh, Table, UserAdd } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, FilterBar, IconBtn, Page, PageHeader, TabsBar, UserPicker } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import RecentList from '../recent/RecentList.svelte';
		import PopPanel from '../shared/PopPanel.svelte';
		import RangeField from '$lib/ui/fields/RangeField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { DEAL_TYPE_LABELS, PRIORITY_LABELS } from '../shared/labels';
	import { products, regions } from '../shared/refs.svelte';
	import type { Deal } from '../types';
	import BulkReassignModal from './list/BulkReassignModal.svelte';
	import DealsBoard from './list/DealsBoard.svelte';
	import DealsTable from './list/DealsTable.svelte';
	import { activeCount, readFilters, toQuery } from './list/dealFilters';
	import { statusName } from './statusUtils';
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
	const filterCount = $derived(activeCount(f, !showOwner) - (f.view === 'board' && f.workflow ? 1 : 0));

	const pager = createPager<Deal>(async (cursor, signal) =>
		unwrap(api.GET('/api/deals', { params: { query: { ...query, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	let board = $state<{ reload: () => Promise<void> }>();
	let selected = $state<string[]>([]);
	let bulkOpen = $state(false);
	let recentOpen = $state(false);
	let innerHeight = $state(900);

	onMount(() => {
		if (!session.can('deal:read')) return;
		void workflows.published.ensure().then((list) => workflows.ensureMany(list.map((w) => w.id))).catch(() => {});
		void regions.ensure().catch(() => {});
		void products.ensure().catch(() => {});
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

	const set = (patch: Record<string, string | null>) => setQuery(patch);
	const reset = () => setQuery({ workflow: null, status: null, type: null, priority: null, owner: null, region: null, product: null, from: null, to: null });
	const refresh = () => (f.view === 'board' ? board?.reload() : pager.reload());

	const publishedList = $derived(workflows.published.value ?? []);
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
	const productItems = $derived((products.value ?? []).map((p) => ({ key: p.id, value: p.name })));

	const quickTabs = [
		{ key: 'all', label: 'Все' },
		{ key: 'mine', label: 'Мои' },
		{ key: 'warning', label: 'Срок под угрозой' },
		{ key: 'breached', label: 'Срок нарушен' },
		{ key: 'closed', label: 'Закрытые' }
	];
	// фильтры, что живут в боковой панели «Фильтры»: тип, регион, продукт, период (и воронка в режиме таблицы)
	const moreActive = $derived([f.type, f.region, f.product, f.from || f.to, f.view === 'table' ? f.workflow : ''].filter(Boolean).length);

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
			{#snippet action()}<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={() => setQuery({ q: null, quick: null, workflow: null, status: null, type: null, priority: null, owner: null, region: null, product: null, from: null, to: null })} />{/snippet}
		</EmptyState>
	{:else}
		<EmptyState title="Сделок пока нет" compact>
			{#snippet action()}{#if canCreate}<Btn label="Новая сделка" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={openCreate} />{/if}{/snippet}
		</EmptyState>
	{/if}
{/snippet}

{#snippet filters()}
	{#if f.view === 'board'}
		<Pick label="Воронка" items={flowItems} clearable value={f.workflow || null} placeholder="Все" onChange={(v) => set({ workflow: v, status: null })} />
	{:else}
		<Pick label="Статус" items={statusItems} clearable search value={f.status || null} placeholder="Все" onChange={(v) => set({ status: v })} />
	{/if}
	{#if showOwner}
		<UserPicker label="Ответственный" roles={['KAM', 'HEAD']} value={f.owner || null} placeholder="Все" onChange={(id) => set({ owner: id })} />
	{/if}
	<Pick label="Приоритет" items={priorityItems} clearable value={f.priority || null} placeholder="Любой" onChange={(v) => set({ priority: v })} />
{/snippet}

{#snippet more()}
	{#if f.view === 'table'}
		<Pick label="Воронка" items={flowItems} clearable value={f.workflow || null} placeholder="Все" onChange={(v) => set({ workflow: v, status: null })} />
	{/if}
	<Pick label="Тип" items={typeItems} clearable value={f.type || null} placeholder="Все" onChange={(v) => set({ type: v, status: null })} />
	<Pick label="Регион" items={regionItems} clearable search value={f.region || null} placeholder="Все" onChange={(v) => set({ region: v })} />
	<Pick label="Продукт" items={productItems} clearable search value={f.product || null} placeholder="Все" onChange={(v) => set({ product: v })} />
	<RangeField label="Создана" from={f.from} to={f.to} onChange={(from, to) => set({ from: from || null, to: to || null })} />
{/snippet}

<Page fill={tableFill}>
	<PageHeader title="Сделки" primary={canCreate ? { label: 'Новая сделка', onclick: openCreate, testid: 'new-deal' } : undefined}>
		{#snippet tabs(underline)}
			{#if canRead}<TabsBar items={quickTabs} value={f.quick} onChange={(key) => set({ quick: key === 'all' ? null : key })} label="Какие сделки показывать" {underline} />{/if}
		{/snippet}
		{#snippet actions()}
			{#if canRead}
				<SegmentedControl value={f.view} size="m" onChange={(v) => setQuery({ view: v === 'board' ? 'board' : null })} aria-label="Вид списка">
					<Segment index="table" label={bp.isMobile ? undefined : 'Таблица'} icon={tableIcon} aria-label="Таблица" />
					<Segment index="board" label={bp.isMobile ? undefined : 'Доска'} icon={boardIcon} aria-label="Доска" />
				</SegmentedControl>
				<IconBtn icon={Refresh} label="Обновить" onclick={refresh} />
				{#if !bp.isMobile}<PopPanel open={recentOpen} onClose={() => (recentOpen = false)} title="Недавно открытые">
					{#snippet trigger()}<IconBtn icon={History} label="Недавние" onclick={() => (recentOpen = !recentOpen)} aria-expanded={recentOpen} />{/snippet}
					<RecentList compact limit={8} />
				</PopPanel>{/if}
			{/if}
		{/snippet}
	</PageHeader>

	{#if !canRead}
		<EmptyState title="Нет доступа к сделкам" compact />
	{:else}
		<FilterBar search={f.q} placeholder="Номер или название" onSearch={(v) => set({ q: v || null })} active={filterCount} onReset={reset} {filters} {more} {moreActive} />

		{#if f.view === 'board'}
			{#if f.workflow}
				<DealsBoard bind:this={board} workflowId={f.workflow} {query} />
			{/if}
		{:else}
			<DealsTable {pager} fill={tableFill} {showOwner} selectable={canBulk} {selected} onSelect={(keys) => (selected = keys)} {actionBar} empty={emptyList} />
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
