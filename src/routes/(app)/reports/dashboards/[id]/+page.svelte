<script lang="ts">
	import { page } from '$app/state';
	import DashboardPage from '$lib/features/config/reports/DashboardPage.svelte';
</script>

<svelte:head><title>Дашборд · RTK School</title></svelte:head>
{#key page.params.id}
	<DashboardPage id={page.params.id ?? ''} />
{/key}
