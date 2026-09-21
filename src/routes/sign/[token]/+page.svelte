<script lang="ts">
	// Публичная страница подписи для внешнего подписанта: по ссылке из письма/СМС, без входа.
	import { page } from '$app/state';
	import { publicAdapter } from '$lib/features/signing/api';
	import PublicShell from '$lib/ui/PublicShell.svelte';
	import SignFlow from '$lib/features/signing/SignFlow.svelte';
	import { SignSession } from '$lib/features/signing/sign-session.svelte';

	const session = $derived(new SignSession(publicAdapter(page.params.token ?? '')));
</script>

<svelte:head>
	<title>Подписание документа · RTK School</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PublicShell>
	{#key page.params.token}
		<SignFlow {session} />
	{/key}
</PublicShell>
