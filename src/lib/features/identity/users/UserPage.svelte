<script lang="ts">
	// Карточка сотрудника: данные, безопасность и действия по статусу (блокировка, пароль, приглашение, передача дел, удаление ПДн).
	import { timezoneLabel } from '../timezones';
	import { onMount, untrack } from 'svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { goto } from '$app/navigation';
	import { CheckField, DateField, KeyValue, KeyValueList } from '$lib/ui';
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
	let promoting = $state(false);
	/** «Выполнить» из согласований: роль и заявка берутся из адреса */
	let approval = $state<{ id: string | null; role: string | null }>({ id: null, role: null });
	let invite = $state<UserCreated | null>(null);
	let resetLink = $state<UserCreated | null>(null);
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

	onMount(() => {
		void teams.load();
		const approvalId = readQuery('approval_id');
		if (approvalId) {
			approval = { id: approvalId, role: readQuery('role') };
			edit = true;
		}
	});

	function closeEdit() {
		edit = false;
		if (approval.id) {
			approval = { id: null, role: null };
			void setQuery({ approval_id: null, role: null });
		}
	}
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
		if (out.reset_url && user) {
			// почта не ушла (или SMTP нет): одноразовая ссылка на самостоятельную установку пароля — показываем администратору один раз
			resetLink = { user, invite_url: out.reset_url, invite_expires_at: out.reset_expires_at ?? null, invite_email_sent: out.email_sent };
		} else toast.success(out.detail || 'Сброс пароля выполнен');
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
					['Часовой пояс', timezoneLabel(user.timezone)]
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
		{@const u = user}
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
					<KeyValueList layout="inline">
						{#each rows as [label, value] (label)}
							<KeyValue {label} {value} />
						{/each}
					</KeyValueList>
				</section>

				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Безопасность">
					<h2 class="t-body-m-strong m-0 mb-3">Безопасность</h2>
					<KeyValueList layout="inline">
						<KeyValue label="Последний вход">{#snippet children()}<DateText value={u.last_login_at} time />{/snippet}</KeyValue>
						{#if u.invited_at}<KeyValue label="Приглашён">{#snippet children()}<DateText value={u.invited_at} time />{/snippet}</KeyValue>{/if}
						{#if u.activated_at}<KeyValue label="Активирован">{#snippet children()}<DateText value={u.activated_at} time />{/snippet}</KeyValue>{/if}
						{#if u.blocked_at}<KeyValue label="Заблокирован">{#snippet children()}<DateText value={u.blocked_at} time />{u.status_reason ? `: ${u.status_reason}` : ''}{/snippet}</KeyValue>{/if}
						<KeyValue label="Смена пароля" value={u.must_change_password ? 'Требуется' : 'Не требуется'} />
						<KeyValue label="Согласие на ПДн" value={u.consent_version ? `версия ${u.consent_version}` : 'не принято'} />
					</KeyValueList>
				</section>
			</div>

			{#if session.can('user:write') && status !== 'anonymized'}
				<section class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Действия">
					<h2 class="t-body-m-strong m-0 mb-1">Действия</h2>
					{#if status === 'invited'}
						<Btn {...outline} label="Выдать новую ссылку-приглашение" loading={invitingBusy} onclick={reinvite} data-testid="user-reinvite" />
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
		onClose={closeEdit}
		onSaved={(next) => {
			user = next;
			closeEdit();
			toast.success('Сохранено');
		}}
		onStale={() => load(true)}
		approvalId={approval.id}
		initialRole={approval.role}
		onPending={() => {
			closeEdit();
			promoting = true;
		}}
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
		note={session.mode === 'demo' ? 'Демо-режим: вход в один клик для этой учётной записи перестанет работать, пока пароль не будет задан заново.' : 'Сессии завершатся. Ссылка на новый пароль уйдёт на почту, если почта настроена; иначе она появится здесь, и её нужно передать сотруднику.'}
		onSubmit={doReset}
		onClose={() => (reset = false)}
	>
		{#snippet extra()}
			<CheckField label="Подозрение на компрометацию" checked={suspect} onChange={(v) => (suspect = v)} />
			{#if suspect}<p class="t-desc-l m-0 text-muted">Подписи за последние 24 часа будут помечены оспоренными.</p>{/if}
		{/snippet}
	</ReasonModal>

	<InviteLinkModal result={invite} onClose={() => (invite = null)} />
	<InviteLinkModal result={resetLink} purpose="reset" onClose={() => (resetLink = null)} />
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
	<ApprovalPendingModal open={promoting} what="Назначение администратора" onClose={() => (promoting = false)} />
	<ApprovalPendingModal open={pending} what="Удаление ПДн сотрудника" onClose={() => (pending = false)} />
{/if}
