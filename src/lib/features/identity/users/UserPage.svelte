<script lang="ts">
	// Карточка сотрудника: данные, безопасность и действия по статусу (блокировка, пароль, приглашение, передача дел, удаление ПДн).
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { CheckField, DateField } from '$lib/ui';
	import { Edit } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import ApprovalPendingModal from '../ApprovalPendingModal.svelte';
	import ErasureRequestModal from '../erasure/ErasureRequestModal.svelte';
	import { roleLabel, userStatusMeta } from '../labels';
	import { USER_STATUS_HINTS } from '../hints';
	import ReasonModal from '../ReasonModal.svelte';
	import { teams } from '../teams.svelte';
	import type { UserCreated, UserOut } from '../types';
	import InviteLinkModal from './InviteLinkModal.svelte';
	import UserEditDrawer from './UserEditDrawer.svelte';

	let { id }: { id: string } = $props();

	let user = $state<UserOut | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);

	let edit = $state(false);
	let block = $state(false);
	let unblock = $state(false);
	let reset = $state(false);
	let erasure = $state(false);
	let pending = $state(false);
	let invite = $state<UserCreated | null>(null);
	let autoUnblock = $state('');
	let suspect = $state(false);
	let invitingBusy = $state(false);

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		try {
			user = await unwrap(api.GET('/api/admin/users/{user_id}', { params: { path: { user_id: id } } }));
			people.ensure([user.manager_id]);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	onMount(() => void teams.load());
	$effect(() => {
		void id;
		untrack(() => void load());
	});

	const path = $derived({ params: { path: { user_id: id } } });
	const isMe = $derived(session.me?.id === id);
	const statusMeta = $derived(userStatusMeta(user?.status ?? ''));
	const status = $derived(user?.status ?? '');

	async function doBlock(reason: string) {
		const when = autoUnblock ? new Date(`${autoUnblock}T00:00:00`).toISOString() : null;
		await unwrap(api.POST('/api/admin/users/{user_id}/block', { ...path, body: { reason, auto_unblock_at: when } }));
		block = false;
		toast.success('Пользователь заблокирован');
		await load(true);
	}
	async function doUnblock(reason: string) {
		await unwrap(api.POST('/api/admin/users/{user_id}/unblock', { ...path, body: { reason: reason || null } }));
		unblock = false;
		toast.success('Пользователь разблокирован');
		await load(true);
	}
	async function doReset(reason: string) {
		const out = await unwrap(api.POST('/api/admin/users/{user_id}/reset-password', { ...path, body: { reason, suspect_compromise: suspect } }));
		reset = false;
		toast.success(out.detail || 'Сброс пароля выполнен');
		await load(true);
	}
	async function reinvite() {
		invitingBusy = true;
		try {
			invite = await unwrap(api.POST('/api/admin/users/{user_id}/invite', path));
			await load(true);
		} catch (e) {
			toast.error(e);
		} finally {
			invitingBusy = false;
		}
	}

	const rows = $derived(
		user
			? [
					['Email', user.email ?? '—'],
					['Должность', user.position ?? '—'],
					['Роль', roleLabel(user.role)],
					['Команда', teams.name(user.team_id)],
					['Руководитель', user.manager_id ? people.name(user.manager_id) : '—'],
					['Часовой пояс', user.timezone]
				]
			: []
	);
	const outline = { variant: 'outline', colorScheme: 'neutral', size: 'm' } as const;
</script>

<Page>
	{#if loading}
		<PageHeader title="Пользователь" back="/admin/users" />
		<Skeleton kind="lines" rows={6} />
	{:else if error || !user}
		<PageHeader title="Пользователь" back="/admin/users" />
		<ErrorState {error} onRetry={() => load()} />
	{:else}
		<PageHeader title={user.display_name || user.full_name} back="/admin/users">
			{#snippet meta()}<StatusChip label={statusMeta.label} tone={statusMeta.tone} hint={USER_STATUS_HINTS[user?.status as keyof typeof USER_STATUS_HINTS]} />{/snippet}
			{#snippet actions()}
				{#if session.can('user:write') && status !== 'anonymized'}
					<Btn label="Изменить" icon={Edit} variant="secondary" colorScheme="neutral" onclick={() => (edit = true)} data-testid="user-edit" />
				{/if}
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-lg:grid-cols-1">
			<div class="flex min-w-0 flex-col gap-4">
				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Данные">
					<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 max-md:grid-cols-1 max-md:gap-y-1">
						{#each rows as [label, value] (label)}
							<dt class="t-desc-l text-muted">{label}</dt>
							<dd class="t-body-m m-0 mb-2 break-words md:mb-0">{value}</dd>
						{/each}
					</dl>
				</section>

				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Безопасность">
					<h2 class="t-body-m-strong m-0 mb-3">Безопасность</h2>
					<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 max-md:grid-cols-1 max-md:gap-y-1">
						<dt class="t-desc-l text-muted">Последний вход</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={user.last_login_at} time /></dd>
						{#if user.invited_at}
							<dt class="t-desc-l text-muted">Приглашён</dt>
							<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={user.invited_at} time /></dd>
						{/if}
						{#if user.activated_at}
							<dt class="t-desc-l text-muted">Активирован</dt>
							<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={user.activated_at} time /></dd>
						{/if}
						{#if user.blocked_at}
							<dt class="t-desc-l text-muted">Заблокирован</dt>
							<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={user.blocked_at} time />{user.status_reason ? `: ${user.status_reason}` : ''}</dd>
						{/if}
						<dt class="t-desc-l text-muted">Смена пароля</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0">{user.must_change_password ? 'Требуется' : 'Не требуется'}</dd>
						<dt class="t-desc-l text-muted">Согласие на ПДн</dt>
						<dd class="t-body-m m-0">{user.consent_version ? `версия ${user.consent_version}` : 'не принято'}</dd>
					</dl>
				</section>
			</div>

			{#if session.can('user:write') && status !== 'anonymized'}
				<section class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Действия">
					<h2 class="t-body-m-strong m-0 mb-1">Действия</h2>
					{#if status === 'invited'}
						<Btn {...outline} label="Отправить приглашение повторно" loading={invitingBusy} onclick={reinvite} data-testid="user-reinvite" />
					{/if}
					{#if status === 'active' && !isMe}
						<Btn {...outline} label="Заблокировать" danger onclick={() => ((autoUnblock = ''), (block = true))} data-testid="user-block" />
					{/if}
					{#if status === 'blocked'}
						<Btn {...outline} label="Разблокировать" onclick={() => (unblock = true)} data-testid="user-unblock" />
					{/if}
					{#if (status === 'active' || status === 'blocked') && !isMe}
						<Btn {...outline} label="Сбросить пароль" onclick={() => ((suspect = false), (reset = true))} data-testid="user-reset" />
					{/if}
					{#if (status === 'active' || status === 'blocked') && !isMe}
						<Btn {...outline} label="Передать дела и уволить" onclick={() => goto(`/admin/users/${id}/offboard`)} data-testid="user-offboard" />
					{/if}
					{#if session.can('erasure:manage') && !isMe}
						<Btn {...outline} label="Запрос на удаление ПДн" danger onclick={() => (erasure = true)} data-testid="user-erasure" />
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</Page>

{#if user}
	<UserEditDrawer
		open={edit}
		{user}
		onClose={() => (edit = false)}
		onSaved={(next) => {
			user = next;
			edit = false;
			toast.success('Сохранено');
		}}
		onStale={() => load(true)}
	/>

	<ReasonModal open={block} title="Заблокировать пользователя" confirmLabel="Заблокировать" danger note="Сессии завершатся сразу, вход станет недоступен." onSubmit={doBlock} onClose={() => (block = false)}>
		{#snippet extra()}
			<DateField label="Разблокировать автоматически (справочно)" value={autoUnblock || null} onChange={(v) => (autoUnblock = v ?? '')} />
		{/snippet}
	</ReasonModal>
	<ReasonModal open={unblock} title="Разблокировать пользователя" confirmLabel="Разблокировать" required={false} label="Причина" onSubmit={doUnblock} onClose={() => (unblock = false)} />
	<ReasonModal
		open={reset}
		title="Сбросить пароль"
		confirmLabel="Сбросить"
		danger
		note={session.mode === 'demo' ? 'Демо-режим: вход в один клик для этой учётной записи перестанет работать, пока пароль не будет задан заново.' : 'Сотруднику придёт ссылка на установку нового пароля, сессии завершатся.'}
		onSubmit={doReset}
		onClose={() => (reset = false)}
	>
		{#snippet extra()}
			<CheckField label="Подозрение на компрометацию" checked={suspect} onChange={(v) => (suspect = v)} />
			{#if suspect}<p class="t-desc-l m-0 text-muted">Подписи за последние 24 часа будут помечены оспоренными.</p>{/if}
		{/snippet}
	</ReasonModal>

	<InviteLinkModal result={invite} onClose={() => (invite = null)} />
	<ErasureRequestModal
		open={erasure}
		subject={{ type: 'user', id, name: user.full_name }}
		onClose={() => (erasure = false)}
		onCreated={(rid) => goto(`/admin/erasure/${rid}`)}
		onPending={() => {
			erasure = false;
			pending = true;
		}}
	/>
	<ApprovalPendingModal open={pending} what="Удаление ПДн сотрудника" onClose={() => (pending = false)} />
{/if}
