<script lang="ts">
	// Вкладка «Сессии»: где выполнен вход, с возможностью завершить любую (текущую — с выходом из системы).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Desktop, Mobile, SignOut } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import Btn from '$lib/ui/Btn.svelte';
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
	let endingOthers = $state(false);
	const hasOthers = $derived(items.some((x) => !x.is_current));

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
				await session.logout(); // also drops the locally stored Bearer tokens
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

	async function endOthers() {
		const ok = await confirm({
			title: 'Завершить остальные сессии?',
			message: 'Все другие устройства будут отключены, эта сессия останется.',
			confirmLabel: 'Завершить остальные',
			danger: true
		});
		if (!ok) return;
		endingOthers = true;
		try {
			const res = await unwrap(api.POST('/api/me/sessions/terminate-others'));
			toast.success(res.terminated ? `Завершено сессий: ${res.terminated}` : 'Других сессий нет');
			await load();
		} catch (e) {
			toast.error(e);
		} finally {
			endingOthers = false;
		}
	}
</script>

{#if loading}
	<Skeleton kind="list" rows={3} />
{:else if error}
	<ErrorState {error} onRetry={load} />
{:else if items.length === 0}
	<EmptyState compact title="Активных сессий нет" />
{:else}
	{#if hasOthers}
		<div class="mb-3 flex justify-end">
			<Btn label="Завершить остальные" variant="outline" colorScheme="neutral" disabled={endingOthers} onclick={endOthers} />
		</div>
	{/if}
	<ul class="m-0 flex list-none flex-col gap-2 p-0">
		{#each items as s (s.sid)}
			{@const Icon = mobile(s) ? Mobile : Desktop}
			<li class="flex items-center gap-3 rounded-lg border border-line bg-surface p-3" data-testid="session-row">
				<span class="inline-flex size-10 flex-none items-center justify-center rounded-full bg-surface-3"><Icon size={22} /></span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="t-body-m-strong">{describeUserAgent(s.user_agent, s.device)}</span>
						{#if s.is_current}<StatusChip label="Это устройство" tone="success" />{/if}
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
