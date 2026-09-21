<script lang="ts">
	// Справочник продуктов: список с фильтрами в URL (поиск, направление, формат, активность) + панель правки.
	import { untrack } from 'svelte';
	import { api, unwrap, ifMatch } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Money, StatusChip, TableCell, type Col } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { PRODUCT_FORMATS, labelOf } from '../labels';
	import type { Product } from '../types';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import SwitchCell from '../shared/SwitchCell.svelte';
	import CatalogList from './CatalogList.svelte';
	import CatalogPage from './CatalogPage.svelte';
	import ProductDrawer from './ProductDrawer.svelte';
	import { directionOptions, directionPath } from './directions';
	import { directions, ensureDirections } from './directions.svelte';

	const q = $derived(readQuery('q'));
	const direction = $derived(readQuery('direction') || null);
	const format = $derived(readQuery('format') || null);
	const active = $derived(readQuery('active') || null);

	const pager = createPager<Product>((cursor, signal) =>
		unwrap(
			api.GET('/api/products', {
				params: { query: { q: q || undefined, direction_id: direction ?? undefined, format: format ?? undefined, is_active: active === null ? undefined : active === '1', limit: 50, cursor } },
				signal
			})
		)
	);

	$effect(() => {
		void [q, direction, format, active];
		untrack(() => void pager.reload());
	});
	ensureDirections();

	const activeCount = $derived([direction, format, active].filter(Boolean).length);
	const dirItems = $derived(directionOptions(directions.data ?? []));
	const dirName = (id: string | null | undefined) => directionPath(directions.data ?? [], id) || '—';

	let drawerOpen = $state(false);
	let editing = $state<Product | null>(null);
	const canWrite = $derived(session.can('catalog:write'));

	function open(item: Product | null) {
		editing = item;
		drawerOpen = true;
	}

	async function toggleActive(p: Product, next: boolean) {
		const saved = await unwrap(api.PATCH('/api/products/{product_id}', { params: { path: { product_id: p.id } }, body: { is_active: next }, headers: ifMatch(p.version) }));
		pager.patch((r) => r.id === p.id, saved);
	}

	const columns: Col<Product>[] = [
		{ key: 'code', title: 'Код', render: codeCell },
		{ key: 'name', title: 'Название', width: 'minmax(200px, 2fr)', render: nameCell },
		{ key: 'direction', title: 'Направление', width: 'minmax(160px, 1fr)', drop: 2, render: dirCell },
		{ key: 'format', title: 'Формат', drop: 1, render: formatCell },
		{ key: 'price', title: 'Цена', align: 'right', render: priceCell },
		{ key: 'active', title: 'Активен', render: activeCell }
	];
</script>

{#snippet codeCell(p: Product)}<TableCell><span class="t-body-s font-mono text-muted">{p.code}</span></TableCell>{/snippet}
{#snippet nameCell(p: Product)}<TableCell><span class="t-body-m-strong">{p.name}</span></TableCell>{/snippet}
{#snippet dirCell(p: Product)}<TableCell><span class="t-body-s text-muted">{dirName(p.direction_id)}</span></TableCell>{/snippet}
{#snippet formatCell(p: Product)}<TableCell><span class="t-body-s">{labelOf(PRODUCT_FORMATS, p.format)}</span></TableCell>{/snippet}
{#snippet priceCell(p: Product)}<TableCell align="right">{#if p.base_price}<Money value={p.base_price} currency={p.currency} />{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet activeCell(p: Product)}<TableCell><SwitchCell checked={p.is_active} label={p.is_active ? 'Отключить продукт' : 'Включить продукт'} disabled={!canWrite} onToggle={(next) => toggleActive(p, next)} /></TableCell>{/snippet}

{#snippet card(p: Product)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-3">
			<span class="t-body-m-strong min-w-0 wrap-anywhere">{p.name}</span>
			<SwitchCell checked={p.is_active} label={p.is_active ? 'Отключить продукт' : 'Включить продукт'} disabled={!canWrite} onToggle={(next) => toggleActive(p, next)} />
		</div>
		<div class="t-desc-l flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
			<span class="font-mono">{p.code}</span>
			{#if p.format}<StatusChip label={labelOf(PRODUCT_FORMATS, p.format)} tone="info" />{/if}
			{#if p.base_price}<Money value={p.base_price} currency={p.currency} />{/if}
		</div>
		{#if p.direction_id}<span class="t-desc-l text-soft">{dirName(p.direction_id)}</span>{/if}
	</div>
{/snippet}

<CatalogPage active="products" createLabel="Новый продукт" onCreate={() => open(null)}>
	{#snippet toolbar()}
		<FilterBar search={q} placeholder="Код или название" onSearch={(v) => setQuery({ q: v })} active={activeCount} onReset={() => setQuery({ direction: null, format: null, active: null })}>
			{#snippet filters()}
				<Pick class="md:w-56" placeholder="Все направления" size="m" search clearable items={dirItems} value={direction} onChange={(v) => setQuery({ direction: v })} />
				<Pick class="md:w-40" placeholder="Любой формат" size="m" clearable items={PRODUCT_FORMATS.map((f) => ({ key: f.key, value: f.value }))} value={format} onChange={(v) => setQuery({ format: v })} />
				<Pick class="md:w-40" placeholder="Любая активность" size="m" clearable items={[{ key: '1', value: 'Активные' }, { key: '0', value: 'Отключённые' }]} value={active} onChange={(v) => setQuery({ active: v })} />
			{/snippet}
		</FilterBar>
	{/snippet}

	<CatalogList
		rows={pager.items}
		{columns}
		{card}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		filtered={Boolean(q) || activeCount > 0}
		emptyText="Продуктов пока нет"
		createLabel="Новый продукт"
		onCreate={() => open(null)}
		onEdit={(p) => open(p)}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		ariaLabel="Продукты"
	/>
</CatalogPage>

<ProductDrawer
	open={drawerOpen}
	item={editing}
	onClose={() => (drawerOpen = false)}
	onSaved={(p, created) => {
		if (created) void pager.reload();
		else pager.patch((r) => r.id === p.id, p);
	}}
/>
