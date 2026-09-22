<script lang="ts">
	// Администрирование → Пользователи: список, поиск/фильтры в URL, создание сотрудника.
	import { onMount } from 'svelte';
	import { UserAdd } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import ApprovalPendingModal from '$lib/features/identity/ApprovalPendingModal.svelte';
	import InviteLinkModal from '$lib/features/identity/users/InviteLinkModal.svelte';
	import UserCreateModal from '$lib/features/identity/users/UserCreateModal.svelte';
	import UsersList from '$lib/features/identity/users/UsersList.svelte';
	import type { UserCreated } from '$lib/features/identity/types';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	let list = $state<{ reload: () => void }>();
	let creating = $state(false);
	let created = $state<UserCreated | null>(null);
	let pending = $state(false);
	let initial = $state<{ full_name?: string; email?: string; role?: string; approval_id?: string }>({});

	// «Выполнить» из согласований открывает эту страницу с предзаполненной формой и approval_id
	onMount(() => {
		if (readQuery('create') === '1') {
			initial = { full_name: readQuery('full_name'), email: readQuery('email'), role: readQuery('role'), approval_id: readQuery('approval_id') };
			creating = true;
		}
	});

	function closeForm() {
		creating = false;
		if (readQuery('create')) void setQuery({ create: null, full_name: null, email: null, role: null, approval_id: null });
	}
</script>

<svelte:head><title>Пользователи · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Пользователи" />
	<UsersList bind:this={list} primary={session.can('user:write') ? { label: 'Создать пользователя', icon: UserAdd, onclick: () => ((initial = {}), (creating = true)), testid: 'user-create' } : undefined} />
</Page>

<UserCreateModal
	open={creating}
	{initial}
	onClose={closeForm}
	onCreated={(res) => {
		closeForm();
		created = res;
		list?.reload();
	}}
	onPending={() => {
		closeForm();
		pending = true;
	}}
/>
<InviteLinkModal result={created} onClose={() => (created = null)} />
<ApprovalPendingModal open={pending} what="Создание администратора" onClose={() => (pending = false)} />
