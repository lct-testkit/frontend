<script lang="ts">
	// Мастер передачи дел: /admin/users/<id>/offboard
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, unwrap } from '$lib/api';
	import OffboardWizard from '$lib/features/identity/offboard/OffboardWizard.svelte';
	import type { UserOut } from '$lib/features/identity/types';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';

	const id = $derived(page.params.id ?? '');
	let user = $state<UserOut | null>(null);
	let error = $state<unknown>(null);

	async function load() {
		error = null;
		try {
			user = await unwrap(api.GET('/api/admin/users/{user_id}', { params: { path: { user_id: id } } }));
		} catch (e) {
			error = e;
		}
	}
	onMount(() => void load());
</script>

<svelte:head><title>Передача дел · RTK School</title></svelte:head>

<Page narrow>
	<PageHeader title={user ? `Передача дел: ${user.full_name}` : 'Передача дел'} back="/admin/users/{id}" />
	{#if error}
		<ErrorState {error} onRetry={load} />
	{:else if !user}
		<Skeleton kind="rows" rows={4} />
	{:else if user.status !== 'active' && user.status !== 'blocked'}
		<ErrorState error={new Error('Передать дела можно только активному или заблокированному сотруднику.')} />
	{:else}
		{#key user.id}<OffboardWizard {user} />{/key}
	{/if}
</Page>
