<script lang="ts">
	import { page } from '$app/state';
	import OrganizationCardPage from '$lib/features/crm/organizations/OrganizationCardPage.svelte';
</script>

{#key page.params.id}
	<OrganizationCardPage id={page.params.id ?? ''} />
{/key}
