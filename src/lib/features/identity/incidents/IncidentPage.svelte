<script lang="ts">
	// Карточка инцидента ПДн: шаги процедуры, сроки уведомления РКН (24 и 72 часа), данные, действия по статусу (подтвердить, сформировать и отметить уведомление, субъекты, закрыть).
	import { onMount, untrack } from 'svelte';
	import { WizardStepsHorizontal } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { Edit, Send } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, DateText, ErrorState, Notice, Page, PageHeader, Skeleton, StatusChip, UserName, confirm, toast } from '$lib/ui';
	import ReasonModal from '../ReasonModal.svelte';
	import { closeIncident, generateRknNotice, generateSubjectsNotice, loadIncident, noticeFileUrl, type RknNotice } from './api';
	import IncidentConfirmModal from './IncidentConfirmModal.svelte';
	import IncidentEditDrawer from './IncidentEditDrawer.svelte';
	import MarkSentModal from './MarkSentModal.svelte';
	import RknNoticeModal from './RknNoticeModal.svelte';
	import {
		INCIDENT_STEPS,
		currentDeadline,
		deadlineInfo,
		incidentActions,
		incidentStatusHint,
		incidentStatusMeta,
		incidentStepIndex,
		severityMeta,
		sourceLabel,
		type Incident,
		type IncidentStage
	} from './incidents';

	let { id }: { id: string } = $props();

	const bp = useBreakpoint();

	let incident = $state<Incident | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let confirming = $state(false);
	let editing = $state(false);
	let closing = $state(false);
	let marking = $state<IncidentStage | null>(null);
	let notice = $state<RknNotice | null>(null);
	let busy = $state<string | null>(null);
	let now = $state(Date.now());

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	async function load(silent = false) {
		if (!silent) loading = true;
		error = null;
		try {
			incident = await loadIncident(id);
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

	const manage = $derived(session.can('incident:manage'));
	const act = $derived(incident ? incidentActions(incident.status, manage) : null);
	const status = $derived(incidentStatusMeta(incident?.status ?? ''));
	const stepIndex = $derived(incidentStepIndex(incident?.status ?? ''));
	const current = $derived(incident ? currentDeadline(incident, now) : null);
	const outline = { variant: 'outline', colorScheme: 'neutral', size: 'm' } as const;
	const STAGE_TITLE = { '24h': '24 часа', '72h': '72 часа' } as const;

	async function generate(stage: IncidentStage) {
		if (!incident) return;
		busy = `gen-${stage}`;
		try {
			notice = await generateRknNotice(incident.id, stage);
		} catch (e) {
			toast.error(e, 'Не удалось сформировать уведомление');
		} finally {
			busy = null;
		}
	}

	async function subjects() {
		if (!incident) return;
		const ok = await confirm({
			title: 'Сформировать уведомление субъектам?',
			message: 'Нужно ли уведомлять субъектов лично, решает юрист по обстоятельствам инцидента. Здесь только готовится текст и файл; отправку и ответственность за неё ведёт человек.',
			confirmLabel: 'Сформировать'
		});
		if (!ok) return;
		busy = 'subjects';
		try {
			const out = await generateSubjectsNotice(incident.id);
			toast.success('Уведомление субъектам сформировано');
			window.open(await noticeFileUrl(incident.id, out.file_id), '_blank', 'noopener');
			await load(true);
		} catch (e) {
			toast.error(e, 'Не удалось сформировать уведомление');
		} finally {
			busy = null;
		}
	}

	async function close(reason: string) {
		if (!incident) return;
		incident = await closeIncident(incident, reason || null);
		closing = false;
		toast.success(incident.status === 'dismissed' ? 'Кандидат отклонён' : 'Инцидент закрыт');
	}

	const set = (next: Incident) => (incident = next);
	const noText = (v: string | null | undefined) => v?.trim() || '—';
</script>

{#snippet deadlineRow(stage: IncidentStage, due: string | null | undefined, sent: string | null | undefined, reference: string | null | undefined)}
	{@const info = deadlineInfo(due, sent, now)}
	<div class="flex min-w-0 flex-col gap-1 rounded-md bg-surface-2 p-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="t-body-s-strong">Уведомление РКН · {STAGE_TITLE[stage]}</span>
			<StatusChip label={info.label} tone={info.tone} />
		</div>
		{#if due}<span class="t-desc-l text-muted">Срок: <DateText value={due} time /></span>{/if}
		{#if sent}
			<span class="t-desc-l text-muted">Подано <DateText value={sent} time />{reference ? `, № ${reference}` : ''}</span>
		{/if}
	</div>
{/snippet}

<Page>
	{#if loading}
		<PageHeader title="Инцидент" back="/admin/incidents" backLabel="Инциденты ПДн" />
		<Skeleton kind="lines" rows={6} />
	{:else if error || !incident}
		<PageHeader title="Инцидент" back="/admin/incidents" backLabel="Инциденты ПДн" />
		<ErrorState {error} onRetry={() => load()} />
	{:else}
		<PageHeader title={incident.title} subtitle={incident.number} back="/admin/incidents" backLabel="Инциденты ПДн">
			{#snippet meta()}
				<StatusChip label={status.label} tone={status.tone} hint={incidentStatusHint(incident?.status ?? '')} />
				<StatusChip label={`Серьёзность: ${severityMeta(incident?.severity ?? '').label.toLowerCase()}`} tone={severityMeta(incident?.severity ?? '').tone} />
			{/snippet}
		</PageHeader>

		{#if bp.isMobile}
			<WizardStepsHorizontal currentStep={stepIndex} steps={INCIDENT_STEPS.map(() => ({ title: '' }))} />
			<p class="t-desc-l m-0 -mt-2 text-muted">Шаг {stepIndex + 1} из {INCIDENT_STEPS.length}: {INCIDENT_STEPS[stepIndex]}</p>
		{:else}
			<WizardStepsHorizontal currentStep={stepIndex} steps={INCIDENT_STEPS.map((title) => ({ title }))} />
		{/if}

		{#if incident.status === 'candidate'}
			<Notice class="shrink-0" tone="warning">Это кандидат: сроки уведомления РКН ещё не идут. Решите, был ли инцидент: подтвердите его — и начнётся отсчёт 24 часов — или отклоните.</Notice>
		{:else if incident.status === 'dismissed'}
			<Notice class="shrink-0" tone="info">Кандидат отклонён: утечки не было.</Notice>
		{:else if current && current.info.state !== 'sent'}
			<Notice class="shrink-0" tone={current.info.state === 'overdue' ? 'error' : current.info.state === 'soon' ? 'warning' : 'info'} role={current.info.state === 'overdue' ? 'alert' : 'status'} data-testid="incident-deadline">
				Уведомление РКН · {STAGE_TITLE[current.stage]}: {current.info.label.toLowerCase()}.{current.info.state === 'overdue' ? ' Подайте уведомление как можно скорее и отметьте отправку.' : ''}
			</Notice>
		{/if}

		<div class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-lg:grid-cols-1">
			<div class="flex min-w-0 flex-col gap-4 max-lg:order-2">
				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Данные инцидента">
					<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 max-md:grid-cols-1 max-md:gap-y-1">
						<dt class="t-desc-l text-muted">Источник</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0">{sourceLabel(incident.source)}{#if incident.event_ids?.length}<span class="text-muted"> · событий безопасности: {incident.event_ids.length}</span>{/if}</dd>
						<dt class="t-desc-l text-muted">Выявлен</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0">{#if incident.detected_at}<DateText value={incident.detected_at} time />{:else}<span class="text-muted">ещё не подтверждён</span>{/if}</dd>
						<dt class="t-desc-l text-muted">Ответственный</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0">{#if incident.responsible_user_id}<UserName id={incident.responsible_user_id} />{:else}—{/if}</dd>
						<dt class="t-desc-l text-muted">Категории данных</dt>
						<dd class="t-body-m m-0 mb-2 wrap-anywhere md:mb-0">{incident.data_categories?.length ? incident.data_categories.join(', ') : '—'}</dd>
						<dt class="t-desc-l text-muted">Субъектов, примерно</dt>
						<dd class="t-body-m m-0 mb-2 md:mb-0">{incident.subjects_estimate ?? '—'}</dd>
						<dt class="t-desc-l text-muted">Описание</dt>
						<dd class="t-body-m m-0 mb-2 wrap-anywhere whitespace-pre-line md:mb-0">{noText(incident.description)}</dd>
						<dt class="t-desc-l text-muted">Причины</dt>
						<dd class="t-body-m m-0 mb-2 wrap-anywhere whitespace-pre-line md:mb-0">{noText(incident.causes)}</dd>
						<dt class="t-desc-l text-muted">Вред субъектам</dt>
						<dd class="t-body-m m-0 mb-2 wrap-anywhere whitespace-pre-line md:mb-0">{noText(incident.harm)}</dd>
						<dt class="t-desc-l text-muted">Принятые меры</dt>
						<dd class="t-body-m m-0 mb-2 wrap-anywhere whitespace-pre-line md:mb-0">{noText(incident.measures)}</dd>
						<dt class="t-desc-l text-muted">Итоги расследования</dt>
						<dd class="t-body-m m-0 wrap-anywhere whitespace-pre-line">{noText(incident.investigation_summary)}</dd>
					</dl>
				</section>

				{#if incident.status !== 'candidate' && incident.status !== 'dismissed'}
					<section class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Сроки уведомлений">
						<h2 class="t-body-m-strong m-0">Сроки уведомлений</h2>
						{@render deadlineRow('24h', incident.rkn_24_due_at, incident.rkn_24_sent_at, incident.rkn_24_reference)}
						{@render deadlineRow('72h', incident.rkn_72_due_at, incident.rkn_72_sent_at, incident.rkn_72_reference)}
						<div class="flex min-w-0 flex-col gap-1 rounded-md bg-surface-2 p-3">
							<span class="t-body-s-strong">Уведомление субъектам</span>
							<span class="t-desc-l text-muted">{#if incident.subjects_notified_at}Сформировано <DateText value={incident.subjects_notified_at} time />{:else}Не формировалось. Нужно ли оно, решает юрист по обстоятельствам инцидента.{/if}</span>
						</div>
					</section>
				{/if}
			</div>

			{#if act && (act.confirm || act.edit || act.stage || act.subjects || act.close || act.dismiss)}
				<section class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 max-md:p-3 max-lg:order-1" aria-label="Действия">
					<h2 class="t-body-m-strong m-0 mb-1">Действия</h2>
					{#if act.confirm}<Btn label="Подтвердить инцидент" onclick={() => (confirming = true)} data-testid="incident-confirm" />{/if}
					{#if act.stage}
						<Btn {...outline} label={`Сформировать уведомление ${STAGE_TITLE[act.stage]}`} loading={busy === `gen-${act.stage}`} onclick={() => generate(act.stage!)} data-testid="incident-generate" />
						<Btn {...outline} label={`Отметить подачу · ${STAGE_TITLE[act.stage]}`} icon={Send} onclick={() => (marking = act.stage)} data-testid="incident-mark" />
					{/if}
					{#if act.subjects}<Btn {...outline} label="Уведомление субъектам" loading={busy === 'subjects'} onclick={subjects} data-testid="incident-subjects" />{/if}
					{#if act.edit}<Btn {...outline} label="Редактировать карточку" icon={Edit} onclick={() => (editing = true)} data-testid="incident-edit" />{/if}
					{#if act.dismiss}<Btn {...outline} label="Отклонить кандидата" danger onclick={() => (closing = true)} data-testid="incident-dismiss" />{/if}
					{#if act.close}<Btn {...outline} label="Закрыть инцидент" onclick={() => (closing = true)} data-testid="incident-close" />{/if}
				</section>
			{:else if !manage}
				<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3 max-lg:order-1" aria-label="Права">
					<p class="t-desc-l m-0 text-muted">Просмотр. Менять инциденты и формировать уведомления может администратор.</p>
				</section>
			{/if}
		</div>

		<IncidentConfirmModal open={confirming} {incident} onClose={() => (confirming = false)} onDone={set} />
		<IncidentEditDrawer open={editing} {incident} onClose={() => (editing = false)} onSaved={set} />
		{#if marking}<MarkSentModal open incident={incident} stage={marking} onClose={() => (marking = null)} onDone={set} />{/if}
		<RknNoticeModal
			{notice}
			incidentId={incident.id}
			canMark={manage}
			onClose={() => (notice = null)}
			onMark={(stage) => {
				notice = null;
				marking = stage;
			}}
			onRegenerate={(stage) => void generate(stage)}
		/>
		<ReasonModal
			open={closing}
			title={incident.status === 'candidate' ? 'Отклонить кандидата' : 'Закрыть инцидент'}
			confirmLabel={incident.status === 'candidate' ? 'Отклонить' : 'Закрыть'}
			danger={incident.status === 'candidate'}
			required={false}
			label="Причина (по желанию)"
			note={incident.status === 'candidate' ? 'Кандидат закроется как «Отклонён»: утечки не было, сроки не пойдут.' : 'Закрытый инцидент больше нельзя менять. Убедитесь, что уведомления поданы, если они были нужны.'}
			onSubmit={close}
			onClose={() => (closing = false)}
		/>
	{/if}
</Page>
