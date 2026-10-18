<script lang="ts">
	// Интеграции (админ): состояние системы, источники, исходящие и входящие сообщения, связи с внешними системами. Вкладка — в `?tab=`.
	import { ApiError } from '$lib/api';
	import { ErrorState, Page, PageHeader } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import SectionTabs from '../shared/SectionTabs.svelte';
	import ApiKeysTab from './ApiKeysTab.svelte';
	import HealthBar from './HealthBar.svelte';
	import InboundTab from './InboundTab.svelte';
	import OutboxTab from './OutboxTab.svelte';
	import RefsTab from './RefsTab.svelte';
	import SourcesTab from './SourcesTab.svelte';
	import SubscriptionsTab from './SubscriptionsTab.svelte';

	const TABS = [
		{ key: 'sources', label: 'Источники' },
		{ key: 'subscriptions', label: 'Подписки' },
		{ key: 'keys', label: 'Ключи API' },
		{ key: 'outbox', label: 'Исходящие' },
		{ key: 'inbound', label: 'Входящие' },
		{ key: 'refs', label: 'Связи' }
	] as const;

	const tab = $derived(TABS.some((t) => t.key === readQuery('tab')) ? readQuery('tab') : 'sources');
	const allowed = $derived(session.can('integration:admin'));
	let subscriptions = $state<SubscriptionsTab | null>(null);
	let keys = $state<ApiKeysTab | null>(null);
</script>

<Page>
	<PageHeader title="Интеграции" primary={!allowed ? undefined : tab === 'subscriptions' ? { label: 'Новая подписка', onclick: () => subscriptions?.create(), testid: 'sub-create' } : tab === 'keys' ? { label: 'Выпустить ключ', onclick: () => keys?.create(), testid: 'key-create' } : undefined}>
		{#snippet tabs(underline)}
			{#if allowed}<SectionTabs tabs={TABS} active={tab} {underline} onSelect={(k) => setQuery({ tab: k === 'sources' ? null : k, source: null, status: null, entity: null })} />{/if}
		{/snippet}
	</PageHeader>
	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'Интеграции доступны администратору.' })} />
	{:else}
		<HealthBar />
		{#if tab === 'sources'}
			<SourcesTab />
		{:else if tab === 'subscriptions'}
			<SubscriptionsTab bind:this={subscriptions} />
		{:else if tab === 'keys'}
			<ApiKeysTab bind:this={keys} />
		{:else if tab === 'outbox'}
			<OutboxTab />
		{:else if tab === 'inbound'}
			<InboundTab />
		{:else}
			<RefsTab />
		{/if}
	{/if}
</Page>
