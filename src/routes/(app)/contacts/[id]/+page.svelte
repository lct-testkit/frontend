<script lang="ts">
	import { page } from '$app/state';
	import ContactCardPage from '$lib/features/crm/contacts/ContactCardPage.svelte';
</script>

{#key page.params.id}
	<ContactCardPage id={page.params.id ?? ''} />
{/key}
