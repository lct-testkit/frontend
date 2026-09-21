<script lang="ts">
	// Blocking dialog until the user accepts the current personal-data policy (new_spec §4.2). Refusal = sign out.
	import { goto } from '$app/navigation';
	import { api, unwrap, errorMessage } from '$lib/api';
	import { POLICY_TEXT } from '$lib/content/policy';
	import { renderMarkdown, sha256Hex } from '$lib/utils/markdown';
	import { session } from '$lib/auth/session.svelte';
	import { toast } from './toast.svelte';
	import AppModal from './AppModal.svelte';
	import Btn from './Btn.svelte';

	let busy = $state(false);
	let failure = $state<string | null>(null);
	const html = renderMarkdown(POLICY_TEXT);

	async function accept() {
		busy = true;
		failure = null;
		try {
			const policy = await unwrap(api.GET('/api/me/policy'));
			const hash = await sha256Hex(POLICY_TEXT);
			if (policy.text_hash && policy.text_hash !== hash) {
				failure = 'Опубликована другая редакция политики. Обновите страницу или обратитесь к администратору.';
				return;
			}
			await unwrap(api.POST('/api/me/consent', { body: { policy_version: policy.version, policy_text_hash: hash } }));
			await session.reload();
			toast.success('Согласие сохранено');
		} catch (e) {
			failure = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function decline() {
		await session.logout();
		void goto('/login');
	}
</script>

<AppModal open={session.consentRequired} size="l" dismissible={false} title="Согласие на обработку персональных данных">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the text of the policy: our own markdown, rendered through DOMPurify -->
	<div class="md">{@html html}</div>
	{#if failure}<p class="t-body-m text-danger" role="alert">{failure}</p>{/if}
	{#snippet footer()}
		<Btn label="Принимаю" loading={busy} onclick={accept} data-testid="consent-accept" />
		<Btn label="Отказаться" variant="secondary" colorScheme="neutral" disabled={busy} onclick={decline} />
	{/snippet}
</AppModal>
