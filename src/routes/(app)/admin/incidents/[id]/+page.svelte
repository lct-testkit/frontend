<script lang="ts">
	import { page } from '$app/state';
	import { ApiError } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import IncidentPage from '$lib/features/identity/incidents/IncidentPage.svelte';
	import { ErrorState, Page, PageHeader } from '$lib/ui';
</script>

<svelte:head><title>Инцидент ПДн · RTK School</title></svelte:head>

{#if !session.can('incident:read')}
	<Page>
		<PageHeader title="Инцидент" back="/admin/incidents" backLabel="Инциденты ПДн" />
		<ErrorState error={new ApiError({ status: 403, detail: 'Реестр инцидентов доступен администратору и аудитору.' })} />
	</Page>
{:else}
	{#key page.params.id}<IncidentPage id={page.params.id ?? ''} />{/key}
{/if}
