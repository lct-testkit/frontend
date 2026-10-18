<script lang="ts">
	// Вкладка «Лицензии» карточки вуза: те же таблица и панель, что на экране «Лицензии», с фильтром по этому вузу (rtk_requiriments.md разд. 4, Треб.1).
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, toast } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import { licenseAccess } from '../licenses/access';
	import { resolveLicense } from '../licenses/licenseApi';
	import LicenseDrawer from '../licenses/LicenseDrawer.svelte';
	import LicenseTable from '../licenses/LicenseTable.svelte';
	import type { OrganizationLicense } from '../types';

	let { orgId }: { orgId: string } = $props();

	const access = $derived(licenseAccess((p) => session.can(p)));

	const pager = createPager<OrganizationLicense>(async (cursor, signal) =>
		unwrap(api.GET('/api/organization-licenses', { params: { query: { organization_id: orgId, with_total: true, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);
	onMount(() => untrack(() => void pager.reload()));

	// состояние панели в адресе (`?tab=licenses&new=1` / `&edit=<id>`): вкладка не сбрасывается
	const creating = $derived(page.url.searchParams.get('new') === '1' && access.create);
	const editId = $derived(page.url.searchParams.get('edit') ?? '');
	let editing = $state<OrganizationLicense | null>(null);
	$effect(() => {
		const id = editId;
		if (!id) {
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
</script>

{#snippet emptyList()}
	<EmptyState title="Лицензий и договоров нет" hint={access.create || access.importFile ? undefined : 'Добавить лицензии может ответственный за вуз.'} compact>
		{#snippet action()}
			<div class="flex flex-wrap justify-center gap-3">
				{#if access.create}<Btn label="Добавить лицензию" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={openCreate} />{/if}
				{#if access.importFile}<Btn label="Импорт лицензий" variant="outline" colorScheme="neutral" onclick={() => void goto('/imports/new?entity=license')} />{/if}
			</div>
		{/snippet}
	</EmptyState>
{/snippet}

<div class="flex min-w-0 flex-col gap-3">
	<div class="flex flex-wrap items-center gap-3">
		{#if access.create}<Btn label="Добавить лицензию" icon={AddLarge} onclick={openCreate} data-testid="org-new-license" />{/if}
		<Btn label="Все лицензии" variant="ghost" colorScheme="neutral" onclick={() => void goto(`/licenses?org=${orgId}`)} />
	</div>
	<LicenseTable
		id="org-licenses"
		rows={pager.items}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		total={pager.total}
		showOrganization={false}
		onRowClick={openEdit}
		empty={emptyList}
	/>
</div>

<LicenseDrawer
	open={creating || editing !== null}
	item={creating ? null : editing}
	{orgId}
	onClose={closeDrawer}
	onSaved={(license, created) => {
		if (created) {
			pager.prepend(license);
			if (pager.total !== undefined) pager.total += 1;
		} else pager.patch((r) => r.id === license.id, license);
	}}
	onDeleted={(id) => {
		pager.remove((r) => r.id === id);
		if (pager.total !== undefined) pager.total = Math.max(0, pager.total - 1);
	}}
/>
