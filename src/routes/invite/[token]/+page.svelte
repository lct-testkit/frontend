<script lang="ts">
	// Public: an emailed invitation link → who is invited, until when, and the way to the sign-in (the backend has the password set by Keycloak).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, unwrap, ApiError, type components } from '$lib/api';
	import { getConfig } from '$lib/config';
	import InviteCard from '$lib/features/identity/InviteCard.svelte';
	import PublicShell from '$lib/ui/PublicShell.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';

	type Invite = components['schemas']['InviteCheckResponse'];

	let invite = $state<Invite | null>(null);
	let error = $state<ApiError | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			invite = await unwrap(api.GET('/api/auth/invite/{token}', { params: { path: { token: page.params.token ?? '' } } }));
		} catch (e) {
			error = e instanceof ApiError ? e : ApiError.network(e);
		} finally {
			loading = false;
		}
	});

	function proceed() {
		if (getConfig().mode === 'demo' || !invite) void goto('/login');
		else location.assign(invite.login_url);
	}
</script>

<svelte:head><title>Приглашение · RTK School</title></svelte:head>

<PublicShell width="sm">
	{#if loading}
		<div class="rounded-lg border border-line bg-surface p-5 max-md:p-4"><Skeleton kind="lines" rows={3} /></div>
	{:else if invite}
		<InviteCard fullName={invite.full_name} emailMasked={invite.email_masked} expiresAt={invite.expires_at} onContinue={proceed} />
	{:else}
		<div class="rounded-lg border border-line bg-surface">
			<EmptyState
				title={error?.status === 429 ? 'Слишком много попыток' : 'Ссылка недействительна'}
				hint={error?.status === 429 ? `Повторите через ${error.retryAfter ?? 60} с.` : 'Она истекла или уже использована. Попросите администратора отправить приглашение повторно.'}
			/>
		</div>
	{/if}
</PublicShell>
