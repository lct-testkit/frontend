<script lang="ts">
	// Вкладка «Сессии»: где выполнен вход, с возможностью завершить любую (текущую — с выходом из системы).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Desktop, Mobile, SignOut } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { confirm } from '$lib/ui/confirm.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { describeUserAgent, sortSessions } from './sessions';
	import type { components } from '$lib/api';

	type Info = components['schemas']['SessionInfo'];

	let items = $state<Info[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let busy = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			items = sortSessions((await unwrap(api.GET('/api/me/sessions'))).items);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	const mobile = (s: Info) => /Android|iPhone|iPad/i.test(s.user_agent ?? '');

	async function end(s: Info) {
		const ok = await confirm({
			title: s.is_current ? 'Завершить эту сессию?' : 'Завершить сессию?',
			message: s.is_current ? 'Вы выйдете из системы на этом устройстве.' : describeUserAgent(s.user_agent, s.device),
			confirmLabel: 'Завершить',
			danger: true
		});
		if (!ok) return;
		busy = s.sid;
		try {
			await unwrap(api.DELETE('/api/me/sessions/{sid}', { params: { path: { sid: s.sid } } }));
			if (s.is_current) {
				session.reset(null);
				await goto('/login');
				return;
			}
			items = items.filter((x) => x.sid !== s.sid);
			toast.success('Сессия завершена');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}
</script>

{#if loading}
	<Skeleton kind="list" rows={3} />
{:else if error}
	<ErrorState {error} onRetry={load} />
{:else if items.length === 0}
	<EmptyState compact title="Других активных сессий нет" />
{:else}
	<ul class="m-0 flex list-none flex-col gap-2 p-0">
		{#each items as s (s.sid)}
			{@const Icon = mobile(s) ? Mobile : Desktop}
			<li class="flex items-center gap-3 rounded-lg border border-line bg-surface p-3" data-testid="session-row">
				<span class="inline-flex size-10 flex-none items-center justify-center rounded-full bg-surface-3"><Icon size={22} /></span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="t-body-m-strong">{describeUserAgent(s.user_agent, s.device)}</span>
						{#if s.is_current}<StatusChip label="Эта сессия" tone="success" />{/if}
					</div>
					<p class="t-desc-l m-0 text-muted">
						{s.ip ?? 'IP неизвестен'} · вход <DateText value={s.created_at} time /> · активность <DateText value={s.last_seen_at} relative />
					</p>
				</div>
				<IconBtn icon={SignOut} label="Завершить сессию" danger disabled={busy === s.sid} onclick={() => end(s)} />
			</li>
		{/each}
	</ul>
{/if}
