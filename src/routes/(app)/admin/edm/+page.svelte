<script lang="ts">
	// Соглашения об ЭДО: без действующего соглашения сторона не сможет подписывать документы внешней подписью.
	import { page } from '$app/state';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import EdmFormDrawer from '$lib/features/signing/edm/EdmFormDrawer.svelte';
	import EdmList, { STATE_TABS, stateTab } from '$lib/features/signing/edm/EdmList.svelte';
	import type { EdmAgreement, EdmPartyType } from '$lib/features/signing/types';
	import { IconBtn, Page, PageHeader, TabsBar } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	let list = $state<{ reload: () => void; add: (a: EdmAgreement) => void }>();

	// панель открывается кнопкой (`?new=1`) или ссылкой «Оформить соглашение» на заблокированном документе (`?new=1&party_type=&party_id=`)
	const PARTY_TYPES: EdmPartyType[] = ['organization', 'contact', 'user'];
	const canCreate = $derived(session.can('edm:admin'));
	const creating = $derived(page.url.searchParams.get('new') === '1' && canCreate);
	const presetPartyType = $derived.by(() => {
		const t = page.url.searchParams.get('party_type');
		return PARTY_TYPES.find((k) => k === t);
	});
	const presetPartyId = $derived(page.url.searchParams.get('party_id') ?? undefined);
	const openCreate = () => void setQuery({ new: '1' }, { push: true });
	const closeCreate = () => void setQuery({ new: null, party_type: null, party_id: null });
</script>

<svelte:head><title>Соглашения ЭДО · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Соглашения ЭДО" primary={canCreate ? { label: 'Новое соглашение', onclick: openCreate, testid: 'edm-create' } : undefined}>
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
	{presetPartyType}
	{presetPartyId}
	onClose={closeCreate}
	onCreated={(a) => {
		closeCreate();
		list?.add(a);
	}}
/>
