<script lang="ts">
	// Подписание: что мне подписать, какие документы известны и из каких шаблонов их можно отправить.
	import DocumentsTab from '$lib/features/signing/DocumentsTab.svelte';
	import InboxTab from '$lib/features/signing/InboxTab.svelte';
	import TemplatesTab from '$lib/features/signing/TemplatesTab.svelte';
	import Page from '$lib/ui/Page.svelte';
	import TabsBar from '$lib/ui/TabsBar.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	const TABS = ['inbox', 'docs', 'templates'];
	const SIGNING_TABS = [
		{ key: 'inbox', label: 'Мне на подпись' },
		{ key: 'docs', label: 'Документы' },
		{ key: 'templates', label: 'Шаблоны' }
	];
	const tab = $derived(TABS.includes(readQuery('tab')) ? readQuery('tab') : 'inbox');
	const scope = $derived(readQuery('scope') === 'all' ? 'all' : 'open');
</script>

<svelte:head><title>Подписание · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Подписание">
		{#snippet tabs(underline)}
			<TabsBar items={SIGNING_TABS} value={tab} {underline} onChange={(t) => void setQuery({ tab: t === 'inbox' ? null : t, scope: null })} label="Разделы подписания" />
		{/snippet}
	</PageHeader>
	{#if tab === 'inbox'}
		<InboxTab {scope} onScope={(next) => void setQuery({ scope: next === 'all' ? 'all' : null })} />
	{:else if tab === 'docs'}
		<DocumentsTab />
	{:else}
		<TemplatesTab />
	{/if}
</Page>
