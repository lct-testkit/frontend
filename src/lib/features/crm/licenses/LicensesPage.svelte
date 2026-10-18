<script lang="ts">
	// Лицензии вуз–вендор–ПО: общий каталог договоров (ТЗ §4 п.1). Таблица на десять полей ТЗ, догрузка курсором по 50, «Найдено: N» от сервера.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { EmptyState, Page, PageHeader } from '$lib/ui';
	import type { OrganizationLicense } from '../types';
	import { licenseAccess } from './access';
	import LicenseTable from './LicenseTable.svelte';

	const access = $derived(licenseAccess((p) => session.can(p)));

	const pager = createPager<OrganizationLicense>((cursor, signal) =>
		unwrap(api.GET('/api/organization-licenses', { params: { query: { with_total: true, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	$effect(() => {
		if (access.read) untrack(() => void pager.reload());
	});
</script>

<svelte:head><title>Лицензии · RTK School</title></svelte:head>

{#snippet emptyList()}
	<EmptyState title="Лицензий пока нет" compact />
{/snippet}

<Page fill>
	<PageHeader title="Лицензии" />
	{#if !access.read}
		<EmptyState title="Нет доступа к лицензиям" compact />
	{:else}
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
			empty={emptyList}
		/>
	{/if}
</Page>
