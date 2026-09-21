<script lang="ts">
	// Публичная проверка подписи: по ссылке/QR из протокола либо по введённому идентификатору. Вход не нужен.
	import { page } from '$app/state';
	import PublicShell from '$lib/ui/PublicShell.svelte';
	import VerifyForm from '$lib/features/signing/VerifyForm.svelte';
	import VerifyView from '$lib/features/signing/VerifyView.svelte';
	import { isUuid } from '$lib/features/signing/urls';

	const id = $derived(page.params.id ?? '');
</script>

<svelte:head>
	<title>Проверка подписи · RTK School</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PublicShell width="sm">
	{#if id && isUuid(id)}
		<VerifyView {id} />
	{:else}
		<VerifyForm />
	{/if}
</PublicShell>
