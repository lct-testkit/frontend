<script lang="ts">
	// Контакты: поиск, организация, «только ЛПР»; «Новый контакт» — главное действие. Фильтры в адресной строке.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AddLarge, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, FilterBar, IconBtn, Page, PageHeader } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import OrgPicker from '../shared/pickers/OrgPicker.svelte';
	import type { Contact } from '../types';
	import ContactCreateDrawer from './ContactCreateDrawer.svelte';
	import ContactsTable from './ContactsTable.svelte';

	const q = $derived(page.url.searchParams.get('q') ?? '');
	const org = $derived(page.url.searchParams.get('org') ?? '');
	const dm = $derived(page.url.searchParams.get('dm') ?? '');
	const creating = $derived(page.url.searchParams.get('new') === '1' && session.can('contact:write'));
	const canWrite = $derived(session.can('contact:write'));

	const params = $derived({ q: q.trim() || undefined, organization_id: org || undefined, is_decision_maker: dm === 'yes' ? true : dm === 'no' ? false : undefined });
	const pager = createPager<Contact>(async (cursor, signal) =>
		unwrap(api.GET('/api/contacts', { params: { query: { ...params, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);

	$effect(() => {
		JSON.stringify(params);
		if (session.can('contact:read')) untrack(() => void pager.reload());
	});

	const dmItems = [
		{ key: 'yes', value: 'Да, ЛПР' },
		{ key: 'no', value: 'Нет' }
	];
	const filterCount = $derived([org, dm].filter(Boolean).length);
	const hasFilters = $derived(filterCount > 0 || !!q);
	const openCreate = () => setQuery({ new: '1' }, { push: true });
</script>

<svelte:head><title>Контакты · RTK School</title></svelte:head>

{#snippet filters()}
	<OrgPicker label="Организация" value={org || null} onChange={(id) => setQuery({ org: id })} />
	<Pick label="Принимает решения" items={dmItems} clearable value={dm || null} placeholder="Все" onChange={(v) => setQuery({ dm: v })} />
{/snippet}

{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}

{#snippet emptyList()}
	<EmptyState title={hasFilters ? 'Ничего не найдено' : 'Контактов пока нет'} compact>
		{#snippet action()}
			{#if hasFilters}
				<Btn label="Сбросить фильтры" variant="outline" colorScheme="neutral" onclick={() => setQuery({ q: null, org: null, dm: null })} />
			{:else if canWrite}
				<Btn label="Новый контакт" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={openCreate} />
			{/if}
		{/snippet}
	</EmptyState>
{/snippet}

<Page fill>
	<PageHeader title="Контакты" />

	{#if !session.can('contact:read')}
		<EmptyState title="Нет доступа к контактам" compact />
	{:else}
		<FilterBar search={q} placeholder="Фамилия, имя, должность" onSearch={(v) => setQuery({ q: v || null })} active={filterCount} onReset={() => setQuery({ org: null, dm: null })} {filters} {trailing} primary={canWrite ? { label: 'Новый контакт', onclick: openCreate, testid: 'new-contact' } : undefined} />
		<ContactsTable {pager} empty={emptyList} fill />
	{/if}
</Page>

<ContactCreateDrawer
	open={creating}
	organizationId={null}
	onClose={() => setQuery({ new: null })}
	onCreated={(c) => {
		void setQuery({ new: null });
		void goto(`/contacts/${c.id}`);
	}}
/>
