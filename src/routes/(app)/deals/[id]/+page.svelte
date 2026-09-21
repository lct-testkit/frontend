<script lang="ts">
	import { page } from '$app/state';
	import DealCardPage from '$lib/features/crm/deals/card/DealCardPage.svelte';
</script>

{#key page.params.id}
	<DealCardPage id={page.params.id ?? ''} />
{/key}
