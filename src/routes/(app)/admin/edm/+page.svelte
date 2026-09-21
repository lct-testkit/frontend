<script lang="ts">
	// Соглашения об ЭДО: без действующего соглашения сторона не сможет подписывать документы внешней подписью.
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import EdmFormDrawer from '$lib/features/signing/edm/EdmFormDrawer.svelte';
	import EdmList, { STATE_TABS, stateTab } from '$lib/features/signing/edm/EdmList.svelte';
	import type { EdmAgreement } from '$lib/features/signing/types';
	import { IconBtn, Page, PageHeader, TabsBar } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	let list = $state<{ reload: () => void; add: (a: EdmAgreement) => void }>();
	let creating = $state(false);
</script>

<svelte:head><title>Соглашения ЭДО · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Соглашения ЭДО" primary={session.can('edm:admin') ? { label: 'Соглашение', onclick: () => (creating = true), testid: 'edm-create' } : undefined}>
		{#snippet tabs(underline)}
			<TabsBar items={STATE_TABS} value={stateTab(readQuery('state'))} label="Какие соглашения показывать" {underline} onChange={(k) => void setQuery({ state: k === 'all' ? '' : k })} />
		{/snippet}
		{#snippet actions()}
			<IconBtn icon={Refresh} label="Обновить" onclick={() => list?.reload()} />
		{/snippet}
	</PageHeader>
	<EdmList bind:this={list} />
</Page>

<EdmFormDrawer
	open={creating}
	onClose={() => (creating = false)}
	onCreated={(a) => {
		creating = false;
		list?.add(a);
	}}
/>
