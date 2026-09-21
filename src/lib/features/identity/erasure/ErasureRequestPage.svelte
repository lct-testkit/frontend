<script lang="ts">
	// Карточка запроса на удаление ПДн: шаги процесса, субъект, блокеры с подсказкой «как снять», действия по статусу.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { WizardStepsHorizontal } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { DocumentDownload, Refresh, Undo } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, DateText, ErrorState, Notice, Page, PageHeader, Skeleton, StatusChip, UserName, confirm, toast } from '$lib/ui';
	import { ERASURE_STEPS, blockerAction, erasureActions, erasureStepIndex, graceCountdown } from '../erasure';
	import { ERASURE_MODE_LABEL, ERASURE_SUBJECT_LABEL, blockerHint, erasureStatusMeta } from '../labels';
	import ReasonModal from '../ReasonModal.svelte';
	import type { ErasureDetail, ErasureMode, ErasureSubjectType } from '../types';
	import { ensureSubjects, subjectHref, subjectName } from './subject';

	let { id }: { id: string } = $props();

	const bp = useBreakpoint();

	let request = $state<ErasureDetail | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let rejecting = $state(false);
	let busy = $state<'recheck' | 'restore' | 'act' | null>(null);

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		try {
			request = await unwrap(api.GET('/api/admin/erasure-requests/{request_id}', { params: { path: { request_id: id } } }));
			ensureSubjects([request]);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		void id;
		untrack(() => void load());
	});

	const path = $derived({ params: { path: { request_id: id } } });
	const statusMeta = $derived(erasureStatusMeta(request?.status ?? ''));
	const act = $derived(request ? erasureActions(request) : null);
	const grace = $derived(graceCountdown(request?.grace_until));
	const steps = ERASURE_STEPS.map((title) => ({ title }));
	const stepIndex = $derived(erasureStepIndex(request?.status ?? ''));
	const outline = { variant: 'outline', colorScheme: 'neutral', size: 'm' } as const;

	async function recheck() {
		busy = 'recheck';
		try {
			const next = await unwrap(api.POST('/api/admin/erasure-requests/{request_id}/recheck', path));
			request = next;
			toast.success(next.status === 'blocked' ? 'Блокеры остались' : 'Блокеров нет — запрос ушёл в отсрочку');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	async function restore() {
		const ok = await confirm({
			title: 'Отменить удаление?',
			message: 'Данные останутся как есть. Блокировка учётной записи не снимается — это отдельное действие в карточке сотрудника.',
			confirmLabel: 'Восстановить'
		});
		if (!ok) return;
		busy = 'restore';
		try {
			request = await unwrap(api.POST('/api/admin/erasure-requests/{request_id}/restore', path));
			toast.success('Удаление отменено');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	async function reject(reason: string) {
		request = await unwrap(api.POST('/api/admin/erasure-requests/{request_id}/reject', { ...path, body: { reason } }));
		rejecting = false;
		toast.success('Запрос отклонён');
	}

	async function openAct() {
		busy = 'act';
		try {
			const res = await unwrap(api.GET('/api/admin/erasure-requests/{request_id}/act', path));
			window.open(res.download_url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	const rows = $derived(
		request
			? ([
					['Субъект', 'subject'],
					['Что делаем', ERASURE_MODE_LABEL[request.mode as ErasureMode] ?? request.mode ?? '—'],
					['Причина', request.reason || '—'],
					['Правовое основание', request.legal_basis || '—'],
					['Запросил', 'author'],
					['Создан', 'created'],
					['Ответить субъекту до', 'deadline'],
					...(request.grace_until ? [['Отсрочка до', 'grace']] : []),
					...(request.executed_at ? [['Исполнен', 'executed']] : [])
				] as [string, string][])
			: []
	);
</script>

<Page>
	{#if loading}
		<PageHeader title="Запрос на удаление" back="/admin/erasure" />
		<Skeleton kind="lines" rows={6} />
	{:else if error || !request}
		<PageHeader title="Запрос на удаление" back="/admin/erasure" />
		<ErrorState {error} onRetry={() => load()} />
	{:else}
		<PageHeader title="Запрос на удаление" back="/admin/erasure">
			{#snippet meta()}<StatusChip label={statusMeta.label} tone={statusMeta.tone} />{/snippet}
		</PageHeader>

		{#if bp.isMobile}
			<!-- five titles do not fit a 360 px screen: numbers only, the current step is spelled out below -->
			<WizardStepsHorizontal currentStep={stepIndex} steps={ERASURE_STEPS.map(() => ({ title: '' }))} />
			<p class="t-desc-l m-0 -mt-2 text-muted">Шаг {stepIndex + 1} из {ERASURE_STEPS.length}: {ERASURE_STEPS[stepIndex]}</p>
		{:else}
			<WizardStepsHorizontal currentStep={stepIndex} {steps} />
		{/if}

		{#if request.status === 'rejected'}
			<Notice class="shrink-0" tone="info">Запрос отклонён{request.rejection_reason ? `: ${request.rejection_reason}` : ''}.</Notice>
		{:else if request.status === 'blocked'}
			<Notice class="shrink-0" tone="error" role="status">Запрос заблокирован: пока есть блокеры, данные не тронем. Снимите их и пересчитайте.</Notice>
		{:else if grace.state === 'active'}
			<Notice class="shrink-0" tone="warning">{grace.label}. До этого момента запрос можно отменить.</Notice>
		{/if}

		<div class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-lg:grid-cols-1">
			<div class="flex min-w-0 flex-col gap-4 max-lg:order-2">
				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Данные запроса">
					<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 max-md:grid-cols-1 max-md:gap-y-1">
						{#each rows as [label, value] (label)}
							<dt class="t-desc-l text-muted">{label}</dt>
							<dd class="t-body-m m-0 mb-2 wrap-anywhere md:mb-0">
								{#if value === 'subject'}
									<a href={subjectHref(request.subject_type, request.subject_id)}>{subjectName(request.subject_type, request.subject_id)}</a>
									<span class="text-muted"> · {ERASURE_SUBJECT_LABEL[request.subject_type as ErasureSubjectType] ?? request.subject_type}</span>
								{:else if value === 'author'}
									<UserName id={request.requested_by} />
								{:else if value === 'created'}
									<DateText value={request.requested_at} time />
								{:else if value === 'deadline'}
									<DateText value={request.deadline_at} />
								{:else if value === 'grace'}
									<DateText value={request.grace_until} time />
								{:else if value === 'executed'}
									<DateText value={request.executed_at} time />
								{:else}
									{value}
								{/if}
							</dd>
						{/each}
					</dl>
				</section>

				{#if request.blockers?.length}
					<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Блокеры">
						<h2 class="t-body-m-strong m-0 mb-3">Что мешает</h2>
						<ul class="m-0 flex list-none flex-col gap-3 p-0">
							{#each request.blockers as blocker (blocker.code)}
								{@const hint = blockerHint(blocker.code, blocker.detail)}
								{@const fix = blockerAction(hint.action, request.subject_type, request.subject_id)}
								<li class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-md bg-surface-2 p-3">
									<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
										<span class="t-body-s-strong">{hint.label}{blocker.count ? ` · ${blocker.count}` : ''}</span>
										<span class="t-desc-l text-muted">{hint.hint || blocker.detail}</span>
										{#if blocker.legal_basis}<span class="t-desc-m text-soft">Основание: {blocker.legal_basis}</span>{/if}
									</div>
									{#if fix}<Btn {...outline} size="s" label={fix.label} onclick={() => goto(fix.href)} />{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>

			{#if act && (act.canRecheck || act.canRestore || act.canReject || act.canAct)}
				<section class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 max-md:p-3 max-lg:order-1" aria-label="Действия">
					<h2 class="t-body-m-strong m-0 mb-1">Действия</h2>
					{#if act.canRecheck}
						<Btn {...outline} label="Пересчитать блокеры" icon={Refresh} loading={busy === 'recheck'} onclick={recheck} data-testid="erasure-recheck" />
					{/if}
					{#if act.canRestore}
						<Btn {...outline} label="Восстановить" icon={Undo} loading={busy === 'restore'} onclick={restore} data-testid="erasure-restore" />
					{/if}
					{#if act.canAct}
						<Btn {...outline} label="Акт об уничтожении" icon={DocumentDownload} loading={busy === 'act'} onclick={openAct} data-testid="erasure-act" />
					{/if}
					{#if act.canReject}
						<Btn {...outline} label="Отклонить запрос" danger onclick={() => (rejecting = true)} data-testid="erasure-reject" />
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</Page>

<ReasonModal
	open={rejecting}
	title="Отклонить запрос"
	confirmLabel="Отклонить"
	danger
	note="Запрос закроется. Если субъект подаст новый — он начнётся с нуля."
	label="Причина отказа"
	onSubmit={reject}
	onClose={() => (rejecting = false)}
/>
