<script lang="ts">
	// Внутренний подписант: тот же экран подписи, что и у внешнего, но по запросу подписи сотрудника.
	import { page } from '$app/state';
	import { ArrowLeft } from '@lct-testkit/rt-ui/icons';
	import { internalAdapter } from '$lib/features/signing/api';
	import SignFlow from '$lib/features/signing/SignFlow.svelte';
	import { SignSession } from '$lib/features/signing/sign-session.svelte';
	import Page from '$lib/ui/Page.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<svelte:head><title>Подписание документа · RTK School</title></svelte:head>

<Page narrow>
	<a class="t-body-s inline-flex w-fit items-center gap-1 text-muted hover:text-accent" href="/signing">
		<ArrowLeft size={16} class="fill-current" />
		К списку
	</a>
	{#key id}
		<SignFlow session={new SignSession(internalAdapter(id))} backHref="/signing" />
	{/key}
</Page>
