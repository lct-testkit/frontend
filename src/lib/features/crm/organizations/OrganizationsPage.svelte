<script lang="ts">
	// Организации: поиск по названию и ИНН, фильтры (регион, тип — в строке; статус ЕГРЮЛ, аккредитация, ответственный — в панели «Фильтры», там всегда не меньше двух) — в адресной строке.
	// В строке два поля, чтобы она оставалась одной и при включённых фильтрах («Сбросить») на ноутбуке 1366–1440.
	// «Новая организация» открывает поиск по реестру (ИНН или название) и создаёт карточку с подставленными реквизитами.
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
		import { AddLarge, AttentionMark, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, DataTable, EmptyState, FilterBar, IconBtn, Page, PageHeader, StatusChip, TableCell, UserName, UserPicker, type Col } from '$lib/ui';
	import { formatDate } from '$lib/utils/format';
	import { setQuery } from '$lib/utils/query-state.svelte';
		import Ico from '../shared/Ico.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { orgTitle } from '../shared/entityCache.svelte';
	import { registryStatusHint } from '../shared/hints';
	import { ORG_TYPE_LABELS, REGISTRY_STATUS_LABELS, REGISTRY_STATUS_SCHEMES } from '../shared/labels';
	import { regionName, regions } from '../shared/refs.svelte';
	import type { Organization } from '../types';
	import OrgCreateDrawer from './OrgCreateDrawer.svelte';

	const get = (name: string) => page.url.searchParams.get(name) ?? '';
	const q = $derived(get('q'));
	const type = $derived(get('type'));
	const region = $derived(get('region'));
	const status = $derived(get('status'));
	const accredited = $derived(get('accredited'));
	const owner = $derived(get('owner'));
	const canWrite = $derived(session.can('organization:write'));
	const showOwner = $derived(session.can('deal:reassign'));
	const creating = $derived(get('new') === '1' && canWrite);

	const params = $derived({
		q: q.trim() || undefined,
		org_type: type || undefined,
		region_id: region || undefined,
		registry_status: status || undefined,
		is_accredited: accredited === 'yes' ? true : accredited === 'no' ? false : undefined,
		owner_id: owner || undefined
	});
	const pager = createPager<Organization>(async (cursor, signal) =>
		unwrap(api.GET('/api/organizations', { params: { query: { ...params, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	onMount(() => {
		if (session.can('organization:read')) void regions.ensure().catch(() => {});
	});
	$effect(() => {
		JSON.stringify(params);
		if (session.can('organization:read')) untrack(() => void pager.reload());
	});
	$effect(() => people.ensure(pager.items.map((o) => o.owner_id)));

	const typeItems = Object.entries(ORG_TYPE_LABELS).map(([key, value]) => ({ key, value }));
	const statusItems = Object.entries(REGISTRY_STATUS_LABELS).map(([key, value]) => ({ key, value }));
	const accItems = [
		{ key: 'yes', value: 'Аккредитованы' },
		{ key: 'no', value: 'Без аккредитации' }
	];
	const regionItems = $derived((regions.value ?? []).map((r) => ({ key: r.id, value: r.name })));
	const filterCount = $derived([type, region, status, accredited, showOwner && owner].filter(Boolean).length);
	const hasFilters = $derived(filterCount > 0 || !!q);
	const reset = () => setQuery({ type: null, region: null, status: null, accredited: null, owner: null });
	const openCreate = () => setQuery({ new: '1' }, { push: true });

	const open = (row: Organization) => void goto(`/organizations/${row.id}`);
	function link(e: MouseEvent) {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) e.stopPropagation();
		else e.preventDefault();
	}

	const columns: Col<Organization>[] = $derived([
		{ key: 'name', title: 'Организация', width: 'minmax(180px, 3fr)', render: nameCell },
		{ key: 'inn', title: 'ИНН', hint: 'Идентификационный номер налогоплательщика', render: innCell, drop: 3 },
		{ key: 'type', title: 'Тип', render: typeCell, drop: 2 },
		{ key: 'region', title: 'Регион', width: 'minmax(140px, 1.2fr)', render: regionCell, drop: 4 },
		{ key: 'registry', title: 'ЕГРЮЛ', hint: 'Статус организации в Едином государственном реестре юридических лиц', render: registryCell },
		{ key: 'accr', title: 'Аккредитация', render: accrCell, drop: 1 },
		...(showOwner ? [{ key: 'owner', title: 'Ответственный', render: ownerCell, drop: 5 }] : [])
	]);
</script>

<svelte:head><title>Организации · RTK School</title></svelte:head>

{#snippet nameCell(row: Organization)}
	<TableCell><a href="/organizations/{row.id}" class="truncate font-medium text-fg" title={row.name} onclick={link}>{orgTitle(row)}</a></TableCell>
{/snippet}
{#snippet innCell(row: Organization)}<TableCell><span class="whitespace-nowrap">{row.inn ?? '—'}</span></TableCell>{/snippet}
{#snippet typeCell(row: Organization)}<TableCell><span class="truncate">{ORG_TYPE_LABELS[row.org_type] ?? row.org_type}</span></TableCell>{/snippet}
{#snippet regionCell(row: Organization)}<TableCell><span class="truncate">{regionName(row.region_id)}</span></TableCell>{/snippet}
{#snippet registryCell(row: Organization)}
	<TableCell>
		{#if row.registry_status}<StatusChip label={REGISTRY_STATUS_LABELS[row.registry_status] ?? row.registry_status} tone={REGISTRY_STATUS_SCHEMES[row.registry_status] ?? 'neutral'} hint={registryStatusHint(row.registry_status)} />{:else}<span class="text-soft">—</span>{/if}
		{#if row.requisites_drift}<span title="Реквизиты изменились в ЕГРЮЛ"><Ico icon={AttentionMark} tone="warning" size={18} /></span>{/if}
	</TableCell>
{/snippet}
{#snippet accrCell(row: Organization)}
	<TableCell><span class="text-muted">{row.is_accredited ? (row.accreditation_until ? `до ${formatDate(row.accreditation_until)}` : 'Да') : '—'}</span></TableCell>
{/snippet}
{#snippet ownerCell(row: Organization)}<TableCell><span class="truncate"><UserName id={row.owner_id} /></span></TableCell>{/snippet}

{#snippet card(row: Organization)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-start justify-between gap-2">
			<span class="t-row-strong break-words">{orgTitle(row)}</span>
			{#if row.registry_status && row.registry_status !== 'active'}<StatusChip label={REGISTRY_STATUS_LABELS[row.registry_status] ?? row.registry_status} tone={REGISTRY_STATUS_SCHEMES[row.registry_status] ?? 'neutral'} hint={registryStatusHint(row.registry_status)} />{/if}
		</div>
		<span class="t-desc-l text-muted">ИНН {row.inn ?? '—'} · {regionName(row.region_id)}</span>
		<span class="t-desc-l text-muted">{ORG_TYPE_LABELS[row.org_type] ?? row.org_type}{row.requisites_drift ? ' · реквизиты изменились' : ''}</span>
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Регион" items={regionItems} clearable search value={region || null} placeholder="Все" onChange={(v) => setQuery({ region: v })} />
	<Pick label="Тип" items={typeItems} clearable value={type || null} placeholder="Все" onChange={(v) => setQuery({ type: v })} />
{/snippet}

{#snippet more()}
	<Pick label="Статус в ЕГРЮЛ" items={statusItems} clearable value={status || null} placeholder="Все" onChange={(v) => setQuery({ status: v })} />
	<Pick label="Аккредитация" items={accItems} clearable value={accredited || null} placeholder="Все" onChange={(v) => setQuery({ accredited: v })} />
	{#if showOwner}<UserPicker label="Ответственный" roles={['KAM', 'HEAD']} value={owner || null} placeholder="Все" onChange={(id) => setQuery({ owner: id })} />{/if}
{/snippet}

{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}

{#snippet emptyList()}
	<EmptyState title={hasFilters ? 'Ничего не найдено' : 'Организаций пока нет'} compact>
		{#snippet action()}
			{#if hasFilters}
				<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={() => setQuery({ q: null, type: null, region: null, status: null, accredited: null, owner: null })} />
			{:else if canWrite}
				<Btn label="Новая организация" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={openCreate} />
			{/if}
		{/snippet}
	</EmptyState>
{/snippet}

<Page fill>
	<PageHeader title="Организации" />

	{#if !session.can('organization:read')}
		<EmptyState title="Нет доступа к организациям" compact />
	{:else}
		<FilterBar search={q} placeholder="Название или ИНН" onSearch={(v) => setQuery({ q: v || null })} active={filterCount} onReset={reset} {filters} {more} moreActive={[status, accredited, showOwner && owner].filter(Boolean).length} {trailing} primary={canWrite ? { label: 'Новая организация', onclick: openCreate, testid: 'new-org' } : undefined} />
		<DataTable
			id="orgs"
			fill
			rows={pager.items}
			{columns}
			{card}
			loading={pager.loading}
			error={pager.error}
			onRetry={() => pager.reload()}
			onRowClick={open}
			rowHref={(row) => `/organizations/${row.id}`}
			hasMore={pager.hasMore}
			loadingMore={pager.loadingMore}
			onLoadMore={() => pager.loadMore()}
			empty={emptyList}
			ariaLabel="Организации"
		/>
	{/if}
</Page>

<OrgCreateDrawer
	open={creating}
	prefillInn={get('inn')}
	onClose={() => setQuery({ new: null, inn: null })}
	onCreated={(org) => {
		void setQuery({ new: null, inn: null });
		void goto(`/organizations/${org.id}`);
	}}
/>
