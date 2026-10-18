<script lang="ts">
	// Лицензии вуз–вендор–ПО: общий каталог договоров (ТЗ §4 п.1). Таблица на десять полей ТЗ, догрузка курсором по 50, «Найдено: N» от сервера.
	// Фильтры (вуз, вендор, ПО в строке; статус, год, подписание в панели «Фильтры») и поиск живут в адресной строке.
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, FilterBar, IconBtn, Page, PageHeader, toast } from '$lib/ui';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import OrgPicker from '../shared/pickers/OrgPicker.svelte';
	import { TRANSFER_STATUS_LABELS } from '../shared/labels';
	import type { OrganizationLicense } from '../types';
	import { licenseAccess } from './access';
	import { resolveLicense } from './licenseApi';
	import LicenseDrawer from './LicenseDrawer.svelte';
	import { FILTER_KEYS, activeCount, moreCount, patchFor, readFilters, toQuery, yearOptions, type LicenseFilters } from './licenseFilters';
	import LicenseTable from './LicenseTable.svelte';
	import { softwareOf } from './licenseCatalog';
	import { shortVendor } from './licenseUtils';
	import { softwareCatalog, vendorsOf } from './licenseCatalog.svelte';

	const access = $derived(licenseAccess((p) => session.can(p)));
	const filters = $derived(readFilters(page.url.searchParams));
	const query = $derived(toQuery(filters));

	const pager = createPager<OrganizationLicense>((cursor, signal) =>
		unwrap(api.GET('/api/organization-licenses', { params: { query: { ...query, with_total: true, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	onMount(() => {
		if (access.read) void softwareCatalog.ensure().catch(() => {});
	});
	$effect(() => {
		JSON.stringify(query);
		if (access.read) untrack(() => void pager.reload());
	});

	// панель лицензии: `?new=1` — новая, `?edit=<id>` — правка (работают «Назад» и ссылка «поделиться»)
	const creating = $derived(page.url.searchParams.get('new') === '1' && access.create);
	const editId = $derived(page.url.searchParams.get('edit') ?? '');
	let editing = $state<OrganizationLicense | null>(null);
	$effect(() => {
		const id = editId;
		if (!id || !access.read) {
			editing = null;
			return;
		}
		let cancelled = false;
		void resolveLicense(untrack(() => pager.items), id)
			.then((found) => {
				if (cancelled) return;
				if (found) editing = found;
				else {
					toast.error('Лицензия не найдена или недоступна');
					void setQuery({ edit: null });
				}
			})
			.catch((e) => {
				if (cancelled) return;
				toast.error(e);
				void setQuery({ edit: null });
			});
		return () => {
			cancelled = true;
		};
	});
	const openCreate = () => void setQuery({ new: '1', edit: null }, { push: true });
	const openEdit = (row: OrganizationLicense) => void setQuery({ edit: row.id, new: null }, { push: true });
	const closeDrawer = () => void setQuery({ new: null, edit: null });
	function saved(license: OrganizationLicense, created: boolean) {
		if (created) {
			pager.prepend(license);
			if (pager.total !== undefined) pager.total += 1;
		} else {
			pager.patch((r) => r.id === license.id, license);
		}
	}

	function deleted(id: string) {
		const had = pager.items.some((r) => r.id === id);
		pager.remove((r) => r.id === id);
		if (had && pager.total !== undefined) pager.total = Math.max(0, pager.total - 1);
	}

	const change = (c: Partial<LicenseFilters>) => void setQuery(patchFor(c, filters));
	const resetFilters = () => void setQuery(Object.fromEntries(FILTER_KEYS.filter((k) => k !== 'q').map((k) => [k, null])));
	const resetAll = () => void setQuery(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));

	const count = $derived(activeCount(filters));
	const hasFilters = $derived(count > 0 || !!filters.q);
	const statusItems = Object.entries(TRANSFER_STATUS_LABELS).map(([key, value]) => ({ key, value }));
	const yearItems = $derived(yearOptions());
	const vendorItems = $derived(vendorsOf(softwareCatalog.value).map((v) => ({ key: v.id, value: shortVendor(v.name) })));
	const productItems = $derived(softwareOf(softwareCatalog.value ?? [], filters.vendor || null).map((p) => ({ key: p.id, value: p.name })));
	const catalogEmpty = $derived(softwareCatalog.loading ? 'Загрузка…' : 'Справочник ПО пуст');
	const signedItems = [
		{ key: 'yes', value: 'Подписана' },
		{ key: 'no', value: 'Не подписана' }
	];
</script>

<svelte:head><title>Лицензии · RTK School</title></svelte:head>

{#snippet filterFields()}
	<OrgPicker label="Вуз" value={filters.org || null} onChange={(id) => change({ org: id ?? '' })} />
	<Pick label="Вендор" items={vendorItems} clearable search value={filters.vendor || null} placeholder="Все" emptyText={catalogEmpty} onChange={(v) => change({ vendor: v ?? '' })} />
	<Pick label="ПО" items={productItems} clearable search value={filters.product || null} placeholder="Всё" emptyText={catalogEmpty} onChange={(v) => change({ product: v ?? '' })} />
{/snippet}

{#snippet more()}
	<MultiPick label="Статус по передаче" items={statusItems} value={filters.status} placeholder="Любой" search={false} onChange={(v) => change({ status: v })} />
	<Pick label="Действует в году" items={yearItems} clearable value={filters.year || null} placeholder="Любой" hint="Лицензия не закончилась до 1 января этого года" onChange={(v) => change({ year: v ?? '' })} />
	<Pick label="Подписание" items={signedItems} clearable value={filters.signed || null} placeholder="Любое" onChange={(v) => change({ signed: (v ?? '') as LicenseFilters['signed'] })} />
{/snippet}

{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}

{#snippet emptyList()}
	<EmptyState title={hasFilters ? 'Ничего не найдено' : 'Лицензий пока нет'} compact>
		{#snippet action()}
			{#if hasFilters}<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={resetAll} />
			{:else if access.create}<Btn label="Добавить лицензию" variant="outline" colorScheme="neutral" onclick={openCreate} />{/if}
		{/snippet}
	</EmptyState>
{/snippet}

<Page fill>
	<PageHeader title="Лицензии" />
	{#if !access.read}
		<EmptyState title="Нет доступа к лицензиям" compact />
	{:else}
		<FilterBar
			search={filters.q}
			placeholder="Вуз, вендор, ПО или договор"
			onSearch={(v) => change({ q: v })}
			active={count}
			onReset={resetFilters}
			filters={filterFields}
			{more}
			moreActive={moreCount(filters)}
			{trailing}
			found={pager.total}
			primary={access.create ? { label: 'Добавить лицензию', onclick: openCreate, testid: 'new-license' } : undefined}
		/>
		<LicenseTable
			fill
			rows={pager.items}
			loading={pager.loading}
			error={pager.error}
			onRetry={() => pager.reload()}
			hasMore={pager.hasMore}
			loadingMore={pager.loadingMore}
			onLoadMore={() => pager.loadMore()}
			total={pager.total}
			onRowClick={openEdit}
			empty={emptyList}
		/>
	{/if}
</Page>

<LicenseDrawer open={creating || editing !== null} item={creating ? null : editing} onClose={closeDrawer} onSaved={saved} onDeleted={deleted} />
