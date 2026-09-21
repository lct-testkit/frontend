<script lang="ts">
	import { page } from '$app/state';
	import ErasureRequestPage from '$lib/features/identity/erasure/ErasureRequestPage.svelte';
</script>

<svelte:head><title>Запрос на удаление ПДн · RTK School</title></svelte:head>

{#key page.params.id}<ErasureRequestPage id={page.params.id ?? ''} />{/key}
