<script lang="ts">
	// Инциденты ПДн (152-ФЗ): реестр, сроки уведомления РКН 24 и 72 часа. Видят администратор и аудитор, менять — только администратор.
	import { goto } from '$app/navigation';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { ApiError } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import IncidentCreateModal from '$lib/features/identity/incidents/IncidentCreateModal.svelte';
	import IncidentsList from '$lib/features/identity/incidents/IncidentsList.svelte';
	import { STATUS_TABS, statusTab } from '$lib/features/identity/incidents/incidents';
	import { ErrorState, IconBtn, Page, PageHeader, TabsBar } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	let list = $state<{ reload: () => void }>();
	let creating = $state(false);

	const allowed = $derived(session.can('incident:read'));
	const manage = $derived(session.can('incident:manage'));
</script>

<svelte:head><title>Инциденты ПДн · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Инциденты ПДн" primary={allowed && manage ? { label: 'Завести инцидент', onclick: () => (creating = true), testid: 'incident-new' } : undefined}>
		{#snippet tabs(underline)}
			{#if allowed}<TabsBar items={STATUS_TABS} value={statusTab(readQuery('status'))} label="Какие инциденты показывать" {underline} onChange={(k) => void setQuery({ status: k === 'all' ? '' : k })} />{/if}
		{/snippet}
		{#snippet actions()}
			{#if allowed}<IconBtn icon={Refresh} label="Обновить" onclick={() => list?.reload()} />{/if}
		{/snippet}
	</PageHeader>
	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'Реестр инцидентов доступен администратору и аудитору.' })} />
	{:else}
		<IncidentsList bind:this={list} />
	{/if}
</Page>

<IncidentCreateModal open={creating} onClose={() => (creating = false)} onCreated={(id) => goto(`/admin/incidents/${id}`)} />
