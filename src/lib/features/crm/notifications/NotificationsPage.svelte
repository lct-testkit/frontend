<script lang="ts">
	// Все уведомления: «Непрочитанные / Все», приоритет, тип объекта. Клик ведёт к объекту и отмечает прочитанным.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CheckLargeDouble, Refresh, Settings } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { Btn, EmptyState, ErrorState, IconBtn, Page, PageHeader, RowList, Skeleton } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import TabsBar from '$lib/ui/TabsBar.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { preloadDeals } from '../shared/entityCache.svelte';
	import { ENTITY_TYPE_LABELS, NOTIFICATION_PRIORITY_LABELS } from '../shared/labels';
	import type { NotificationItem } from '../types';
	import NotificationRow from './NotificationRow.svelte';
	import { notifications } from './notifications.svelte';

	const view = $derived(page.url.searchParams.get('view') ?? 'unread');
	const priority = $derived(page.url.searchParams.get('priority') ?? '');
	const entity = $derived(page.url.searchParams.get('entity') ?? '');

	const params = $derived({ is_read: view === 'unread' ? false : undefined, priority: priority || undefined, entity_type: entity || undefined });
	const pager = createPager<NotificationItem>(async (cursor, signal) =>
		unwrap(api.GET('/api/notifications', { params: { query: { ...params, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	$effect(() => {
		JSON.stringify(params);
		untrack(() => void pager.reload());
	});

	$effect(() => {
		void preloadDeals(pager.items.filter((n) => n.entity_type === 'deal').map((n) => n.entity_id)).catch(() => {});
	});

	const chips = [
		{ key: 'unread', label: 'Непрочитанные' },
		{ key: 'all', label: 'Все' }
	];
	const priorityItems = Object.entries(NOTIFICATION_PRIORITY_LABELS).map(([key, value]) => ({ key, value }));
	const entityItems = ['deal', 'organization', 'contact', 'task', 'signature_request', 'signature_document'].map((key) => ({ key, value: ENTITY_TYPE_LABELS[key] ?? key }));
	const filterCount = $derived([priority, entity].filter(Boolean).length);

	async function read(item: NotificationItem) {
		await notifications.markRead([item.id]);
		if (view === 'unread') pager.remove((n) => n.id === item.id);
		else pager.patch((n) => n.id === item.id, { ...item, is_read: true });
	}

	async function open(item: NotificationItem, href: string | null) {
		if (!item.is_read) void read(item);
		if (href) await goto(href);
	}

	async function readAll() {
		await notifications.markAll({ priority: priority || undefined, entity_type: entity || undefined });
		await pager.reload();
	}
</script>

<svelte:head><title>Уведомления · RTK School</title></svelte:head>

{#snippet filters()}
	<Pick label="Приоритет" items={priorityItems} clearable value={priority || null} placeholder="Любой" onChange={(v) => setQuery({ priority: v })} />
	<Pick label="Объект" items={entityItems} clearable value={entity || null} placeholder="Любой" onChange={(v) => setQuery({ entity: v })} />
{/snippet}

<Page narrow>
	<PageHeader title="Уведомления">
		{#snippet tabs(underline)}
			<TabsBar items={chips} value={view} {underline} onChange={(k) => setQuery({ view: k === 'unread' ? null : k })} label="Какие уведомления показывать" />
		{/snippet}
		{#snippet actions()}
			<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />
			<IconBtn icon={CheckLargeDouble} label="Прочитать все" onclick={readAll} disabled={notifications.unread === 0} />
			<IconBtn icon={Settings} label="Настройки уведомлений" onclick={() => goto('/notifications/settings')} />
		{/snippet}
	</PageHeader>

	<FilterBar active={filterCount} onReset={() => setQuery({ priority: null, entity: null })} {filters} />

	{#if pager.loading && pager.items.length === 0}
		<Skeleton kind="list" rows={5} />
	{:else if pager.error}
		<ErrorState error={pager.error} onRetry={() => pager.reload()} />
	{:else if pager.items.length === 0}
		<EmptyState title={view === 'unread' ? 'Непрочитанных нет' : 'Уведомлений нет'} compact />
	{:else}
		<RowList label="Уведомления">
			{#each pager.items as item (item.id)}
				<NotificationRow {item} onOpen={open} onRead={read} />
			{/each}
		</RowList>
		{#if pager.hasMore}<div class="flex justify-center"><Btn label="Показать ещё" variant="outline" colorScheme="neutral" loading={pager.loadingMore} onclick={() => pager.loadMore()} /></div>{/if}
	{/if}
</Page>
