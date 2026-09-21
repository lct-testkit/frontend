<script lang="ts">
	// Профиль: данные учётной записи, мои сессии, безопасность (?tab=profile|sessions|security).
	import PasswordPanel from '$lib/features/identity/PasswordPanel.svelte';
	import ProfilePanel from '$lib/features/identity/ProfilePanel.svelte';
	import SessionsPanel from '$lib/features/identity/SessionsPanel.svelte';
	import Page from '$lib/ui/Page.svelte';
	import TabsBar from '$lib/ui/TabsBar.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	const TABS = ['profile', 'sessions', 'security'];
	const PROFILE_TABS = [
		{ key: 'profile', label: 'Профиль' },
		{ key: 'sessions', label: 'Сессии' },
		{ key: 'security', label: 'Безопасность' }
	];
	const tab = $derived(TABS.includes(readQuery('tab')) ? readQuery('tab') : 'profile');
</script>

<svelte:head><title>Профиль · RTK School</title></svelte:head>

<Page narrow>
	<PageHeader title="Профиль">
		{#snippet tabs(underline)}
			<TabsBar items={PROFILE_TABS} value={tab} {underline} onChange={(t) => void setQuery({ tab: t === 'profile' ? null : t })} label="Разделы профиля" />
		{/snippet}
	</PageHeader>
	{#if tab === 'profile'}
		<ProfilePanel />
	{:else if tab === 'sessions'}
		<SessionsPanel />
	{:else}
		<PasswordPanel />
	{/if}
</Page>
