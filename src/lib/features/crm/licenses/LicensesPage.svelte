<script lang="ts">
	// Лицензии вуз–вендор–ПО: общий каталог договоров (ТЗ §4 п.1).
	import { session } from '$lib/auth/session.svelte';
	import { EmptyState, Page, PageHeader } from '$lib/ui';
	import { licenseAccess } from './access';

	const access = $derived(licenseAccess((p) => session.can(p)));
</script>

<svelte:head><title>Лицензии · RTK School</title></svelte:head>

<Page fill>
	<PageHeader title="Лицензии" />
	{#if !access.read}
		<EmptyState title="Нет доступа к лицензиям" compact />
	{/if}
</Page>
