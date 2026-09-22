<script lang="ts">
	// «Четыре глаза»: заявки на необратимые/привилегированные операции, которые подтверждает второй администратор.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CheckLarge, CloseLarge, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, type components } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { approvalActions, approvalExecuteHref, describeApproval } from '$lib/features/identity/approvals';
	import { approvalOperationLabel, approvalStatusMeta } from '$lib/features/identity/labels';
	import ReasonModal from '$lib/features/identity/ReasonModal.svelte';
	import { Btn, DateText, IconBtn, Page, PageHeader, DataTable, StatusChip, TabsBar, UserName, toast, confirm, type Col, TableCell } from '$lib/ui';

	type Approval = components['schemas']['ApprovalOut'];

	const FILTERS = [
		{ key: 'pending', label: 'Ожидают' },
		{ key: 'approved', label: 'Подтверждены' },
		{ key: 'all', label: 'Все' }
	] as const;

	const status = $derived((FILTERS.find((f) => f.key === page.url.searchParams.get('status'))?.key ?? 'pending') as (typeof FILTERS)[number]['key']);
	const meId = $derived(session.me?.id ?? '');

	const pager = createPager<Approval>(async (cursor, signal) =>
		unwrap(api.GET('/api/admin/approvals', { params: { query: { status: status === 'all' ? undefined : status, limit: 50, cursor: cursor ?? undefined } }, signal }))
	);
	$effect(() => {
		void status;
		void pager.reload();
	});
	onMount(() => () => pager.abort());

	let rejecting = $state<Approval | null>(null);
	let busy = $state<string | null>(null);

	function replace(next: Approval) {
		pager.patch((a) => a.id === next.id, next);
	}

	async function approve(a: Approval) {
		// «Четыре глаза»: подтверждение и есть та самая вторая проверка — оно не должно уходить одним нечаянным кликом
		if (!(await confirm({ title: `Подтвердить: ${describeApproval(a)}?`, message: 'Инициатор сможет выполнить операцию сразу после этого.', confirmLabel: 'Подтвердить' }))) return;
		busy = a.id;
		try {
			replace(await unwrap(api.POST('/api/admin/approvals/{approval_id}/approve', { params: { path: { approval_id: a.id } } })));
			toast.success('Операция подтверждена', 'Инициатор может её выполнить');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	async function reject(reason: string) {
		if (!rejecting) return;
		const next = await unwrap(api.POST('/api/admin/approvals/{approval_id}/reject', { params: { path: { approval_id: rejecting.id } }, body: { reason } }));
		replace(next);
		rejecting = null;
		toast.success('Заявка отклонена');
	}

	const columns: Col<Approval>[] = [
		{ key: 'operation', title: 'Операция', width: 'minmax(220px, 2fr)', render: opCell },
		{ key: 'requested_by', title: 'Инициатор', width: 'minmax(140px, 1fr)', drop: 2, render: whoCell },
		{ key: 'created_at', title: 'Создана', drop: 1, render: dateCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'actions', title: '', align: 'right', render: actionCell }
	];
</script>

{#snippet opCell(a: Approval)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-2">
			<span class="t-body-s-strong truncate">{approvalOperationLabel(a.operation)}</span>
			<span class="t-desc-m truncate text-muted">{describeApproval(a)}</span>
		</span>
	</TableCell>
{/snippet}
{#snippet whoCell(a: Approval)}<TableCell><span class="block truncate py-2"><UserName id={a.requested_by} /></span></TableCell>{/snippet}
{#snippet dateCell(a: Approval)}<TableCell><span class="block py-2"><DateText value={a.created_at} relative /></span></TableCell>{/snippet}
{#snippet statusCell(a: Approval)}
	<TableCell>
		{@const meta = approvalStatusMeta(approvalActions(a, meId).isExpired ? 'expired' : a.status)}
		<span class="block py-2"><StatusChip label={meta.label} tone={meta.tone} /></span>
	</TableCell>
{/snippet}
{#snippet buttons(a: Approval)}
	{@const act = approvalActions(a, meId)}
	<span class="flex items-center justify-end gap-1 py-1 max-md:justify-start">
		{#if act.canApprove}<Btn label="Подтвердить" size="s" icon={CheckLarge} loading={busy === a.id} onclick={() => approve(a)} />{/if}
		{#if act.canExecute}<Btn label="Выполнить" size="s" onclick={() => goto(approvalExecuteHref(a) ?? '/admin/users')} />{/if}
		{#if act.waitingForOther}<span class="t-desc-m truncate text-muted" title="Заявку должен подтвердить другой администратор">Нужен другой админ</span>{/if}
		{#if act.canReject}<IconBtn icon={CloseLarge} label="Отклонить" danger size="s" onclick={() => (rejecting = a)} />{/if}
	</span>
{/snippet}
{#snippet actionCell(a: Approval)}<TableCell align="right">{@render buttons(a)}</TableCell>{/snippet}
{#snippet card(a: Approval)}
	<div class="flex min-w-0 flex-col gap-2">
		<div class="flex items-start justify-between gap-2">
			<span class="t-body-s-strong min-w-0">{approvalOperationLabel(a.operation)}</span>
			{#snippet chip()}{@const meta = approvalStatusMeta(a.status)}<StatusChip label={meta.label} tone={meta.tone} />{/snippet}
			{@render chip()}
		</div>
		<span class="t-desc-l text-muted">{describeApproval(a)}</span>
		<span class="t-desc-m text-soft"><UserName id={a.requested_by} /> · <DateText value={a.created_at} relative /></span>
		{@render buttons(a)}
	</div>
{/snippet}

<svelte:head><title>Согласования · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Согласования">
		{#snippet tabs(underline)}
			<TabsBar items={FILTERS} value={status} label="Какие заявки показывать" {underline} onChange={(key) => goto(`?status=${key}`, { replaceState: true, keepFocus: true, noScroll: true })} />
		{/snippet}
		{#snippet actions()}<IconBtn icon={Refresh} label="Обновить" onclick={() => pager.reload()} />{/snippet}
	</PageHeader>

	<DataTable
		rows={pager.items}
		{columns}
		{card}
		loading={pager.loading}
		error={pager.error}
		onRetry={() => pager.reload()}
		hasMore={pager.hasMore}
		loadingMore={pager.loadingMore}
		onLoadMore={() => pager.loadMore()}
		emptyText={status === 'pending' ? 'Ожидающих заявок нет' : 'Заявок нет'}
		ariaLabel="Заявки на подтверждение"
	/>
</Page>

<ReasonModal
	open={rejecting !== null}
	title="Отклонить заявку"
	confirmLabel="Отклонить"
	danger
	required={false}
	label="Причина (необязательно)"
	onSubmit={reject}
	onClose={() => (rejecting = null)}
/>
