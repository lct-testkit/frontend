<script lang="ts">
	// Feature flags and system settings (ADMIN). `?tab=flags|system`.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FlagsPanel from '$lib/features/identity/settings/FlagsPanel.svelte';
	import SettingsPanel from '$lib/features/identity/settings/SettingsPanel.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import TabsBar from '$lib/ui/TabsBar.svelte';

	const tab = $derived(page.url.searchParams.get('tab') === 'system' ? 'system' : 'flags');
	const open = (v: string) => void goto(`?tab=${v}`, { replaceState: true, keepFocus: true, noScroll: true });
</script>

<svelte:head><title>Настройки · RTK School</title></svelte:head>

<Page narrow>
	<PageHeader title="Настройки">
		{#snippet tabs(underline)}
			<TabsBar items={[{ key: 'flags', label: 'Флаги' }, { key: 'system', label: 'Система' }]} value={tab} {underline} onChange={open} label="Разделы настроек" />
		{/snippet}
	</PageHeader>
	{#if tab === 'flags'}<FlagsPanel />{:else}<SettingsPanel />{/if}
</Page>
