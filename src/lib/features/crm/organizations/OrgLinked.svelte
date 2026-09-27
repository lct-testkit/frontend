<script lang="ts">
	// Вкладки «Контакты» и «Сделки» организации: те же таблицы, что в общих списках, с фильтром по организации.
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState } from '$lib/ui';
	import ContactCreateDrawer from '../contacts/ContactCreateDrawer.svelte';
	import ContactsTable from '../contacts/ContactsTable.svelte';
	import DealsTable from '../deals/list/DealsTable.svelte';
	import type { Contact, Deal } from '../types';

	let { orgId, kind }: { orgId: string; kind: 'contacts' | 'deals' } = $props();

	const contacts = createPager<Contact>(async (cursor, signal) =>
		unwrap(api.GET('/api/contacts', { params: { query: { organization_id: orgId, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);
	const deals = createPager<Deal>(async (cursor, signal) =>
		unwrap(api.GET('/api/deals', { params: { query: { organization_id: orgId, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	let creating = $state(false);
	onMount(() => untrack(() => void (kind === 'contacts' ? contacts.reload() : deals.reload())));
</script>

<div class="flex min-w-0 flex-col gap-3">
	{#if kind === 'contacts'}
		{#if session.can('contact:write')}
			<div><Btn label="Новый контакт" icon={AddLarge} onclick={() => (creating = true)} data-testid="org-new-contact" /></div>
		{/if}
		<ContactsTable pager={contacts} showOrganization={false}>
			{#snippet empty()}<EmptyState title="Контактов пока нет" compact />{/snippet}
		</ContactsTable>
		<ContactCreateDrawer
			open={creating}
			organizationId={orgId}
			onClose={() => (creating = false)}
			onCreated={(c) => {
				creating = false;
				contacts.prepend(c);
			}}
		/>
	{:else}
		{#if session.can('deal:create')}
			<div class="max-md:hidden"><Btn label="Новая сделка" icon={AddLarge} onclick={() => goto(`/deals?new=1&org=${orgId}`)} /></div>
		{/if}
		<DealsTable pager={deals}>
			{#snippet empty()}<EmptyState title="Сделок пока нет" compact />{/snippet}
		</DealsTable>
	{/if}
</div>
