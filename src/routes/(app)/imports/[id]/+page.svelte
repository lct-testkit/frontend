<script lang="ts">
	import { page } from '$app/state';
	import ImportDetailPage from '$lib/features/config/imports/ImportDetailPage.svelte';
</script>

<svelte:head><title>Импорт · RTK School</title></svelte:head>
{#key page.params.id}
	<ImportDetailPage id={page.params.id ?? ''} />
{/key}
