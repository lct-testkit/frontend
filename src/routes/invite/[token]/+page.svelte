<script lang="ts">
	// Public: an invitation link → who is invited, until when, and the form to set the password (no letter needed); then the way to the sign-in.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getConfig } from '$lib/config';
	import { InviteFlow } from '$lib/features/identity/invite.svelte';
	import InviteCard from '$lib/features/identity/InviteCard.svelte';
	import PublicShell from '$lib/ui/PublicShell.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';

	const flow = new InviteFlow();

	onMount(() => void flow.load(page.params.token ?? ''));

	function proceed() {
		if (getConfig().mode === 'demo' || !flow.loginUrl) void goto('/login');
		else location.assign(flow.loginUrl);
	}
</script>

<svelte:head><title>Приглашение · RTK School</title></svelte:head>

<PublicShell width="sm">
	{#if flow.phase === 'loading'}
		<div class="rounded-lg border border-line bg-surface p-5 max-md:p-4"><Skeleton kind="lines" rows={3} /></div>
	{:else if flow.phase === 'failed'}
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={flow.loadError} onRetry={() => void flow.load(page.params.token ?? '')} /></div>
	{:else if flow.phase === 'invalid'}
		<div class="rounded-lg border border-line bg-surface">
			<EmptyState
				title={flow.loadError?.status === 429 ? 'Слишком много попыток' : 'Ссылка недействительна'}
				hint={flow.loadError?.status === 429 ? `Повторите через ${flow.retryAfter ?? 60} с.` : 'Она истекла или уже использована. Попросите администратора выдать новую ссылку.'}
			/>
		</div>
	{:else}
		<InviteCard {flow} onContinue={proceed} />
	{/if}
</PublicShell>
