<script lang="ts">
	// Мастер архивации статуса (4 шага): влияние → куда перенести сделки → предпросмотр → выполнение.
	// Бэкенд не отдаёт ход переноса (backend-issues #1): после запроса опрашиваем воронку, пока статус не станет архивным.
	import { onDestroy, untrack } from 'svelte';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, ifMatch, errorMessage } from '$lib/api';
	import { Btn, ErrorState, Notice, RadioField, Skeleton, WizardSteps } from '$lib/ui';
	import AppModal from '$lib/ui/AppModal.svelte';
	import { count } from '$lib/utils/format';
	import type { StatusImpact } from '../../types';
	import { SLA_MODES, SLA_MODE_LABELS, type SlaMode, type StatusDraft } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';
	import { createPoller } from '../../shared/polling.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';

	interface Props {
		editor: WorkflowEditor;
		/** null — мастер закрыт */
		status: StatusDraft | null;
		onClose: () => void;
	}

	let { editor, status, onClose }: Props = $props();

	const STEPS = ['Влияние', 'Куда перенести', 'Проверка', 'Выполнение'];
	let step = $state(0);
	let impact = $state<StatusImpact | null>(null);
	let loading = $state(false);
	let error = $state<unknown>(null);
	let target = $state<string | null>(null);
	let fallback = $state<string | null>(null);
	let sla = $state<SlaMode>('recalculate');
	let running = $state(false);
	let outcome = $state<'done' | 'failed' | 'slow' | null>(null);
	let outcomeText = $state('');
	let waited = 0;

	const poller = createPoller(
		async () => {
			waited += 2;
			const graph = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: editor.id } } }));
			if (graph.statuses.find((s) => s.id === status?.id)?.is_archived) {
				await finish('done', 'Статус в архиве, сделки перенесены.');
				return false;
			}
			if (waited >= 180) {
				await finish('slow', 'Перенос ещё идёт в фоне. Обновите страницу через минуту.');
				return false;
			}
			return true;
		},
		{ interval: 2000 }
	);
	onDestroy(() => poller.stop());

	const open = $derived(status !== null);
	const others = $derived(editor.liveStatuses.filter((s) => s.id && s.key !== status?.key));
	const targetItems = $derived((impact?.suggested_targets?.length ? impact.suggested_targets : others.map((s) => ({ id: s.id as string, name: s.name }))).filter((t) => t.id !== status?.id).map((t) => ({ key: t.id, value: t.name })));
	const fallbackItems = $derived(others.filter((s) => s.key !== target && s.id !== target).map((s) => ({ key: s.id as string, value: s.name })));
	const targetName = $derived(targetItems.find((t) => t.key === target)?.value ?? '');
	const fallbackName = $derived(fallbackItems.find((t) => t.key === fallback)?.value ?? '');
	const deals = $derived(impact?.active_count ?? 0);
	const targetStatus = $derived(others.find((s) => s.id === target));

	$effect(() => {
		if (!status) return;
		untrack(() => {
			step = 0;
			impact = null;
			error = null;
			target = null;
			fallback = null;
			sla = 'recalculate';
			running = false;
			outcome = null;
			waited = 0;
			poller.stop();
			void loadImpact();
		});
	});

	async function loadImpact() {
		if (!status?.id) return;
		loading = true;
		error = null;
		try {
			impact = await unwrap(api.GET('/api/workflows/{workflow_id}/statuses/{status_id}/impact', { params: { path: { workflow_id: editor.id, status_id: status.id } } }));
			target = impact.suggested_targets?.find((t) => t.id !== status?.id)?.id ?? null;
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	async function finish(kind: 'done' | 'failed' | 'slow', text: string) {
		outcome = kind;
		outcomeText = text;
		running = false;
		await editor.load(true);
	}

	async function run() {
		if (!status?.id || !target || !editor.workflow) return;
		running = true;
		step = 3;
		outcome = null;
		try {
			const res = await unwrap(
				api.POST('/api/workflows/{workflow_id}/statuses/{status_id}/archive', {
					params: { path: { workflow_id: editor.id, status_id: status.id } },
					body: { target_status_id: target, fallback_status_id: fallback, sla_mode: sla },
					headers: ifMatch(editor.workflow.version)
				})
			);
			if (res.job_status === 'completed') await finish('done', res.affected_count ? `Перенесено ${count(res.affected_count, ['сделка', 'сделки', 'сделок'])}.` : 'Статус в архиве.');
			else if (res.job_status === 'failed') await finish('failed', 'Перенос сделок не удался. Статус не архивирован.');
			else {
				waited = 0;
				poller.start();
			}
		} catch (e) {
			await finish('failed', errorMessage(e));
		}
	}

	const canNext = $derived(step === 0 ? !loading && !error && impact !== null : step === 1 ? target !== null : step === 2);
	function next() {
		if (step === 2) void run();
		else step += 1;
	}
</script>

<AppModal {open} title={status ? `Архивация статуса «${status.name}»` : ''} size="m" dismissible={!running} onClose={onClose}>
	<WizardSteps steps={STEPS} current={step} compact />

	{#if step === 0}
		{#if error}
			<ErrorState {error} onRetry={loadImpact} compact />
		{:else if loading || !impact}
			<Skeleton kind="lines" rows={3} />
		{:else}
			<div class="flex flex-col gap-3">
				{#if deals > 0}
					<p class="t-body-m">В статусе <b>{count(deals, ['активная сделка', 'активные сделки', 'активных сделок'])}</b>{impact.sla_affected ? `, у ${impact.sla_affected} из них SLA под угрозой` : ''}. Они будут перенесены в выбранный статус.</p>
				{:else}
					<p class="t-body-m">Сделок в статусе нет — он уйдёт в архив без переноса.</p>
				{/if}
				{#if !impact.supported}<Notice class="shrink-0" tone="warning">Автоматический перенос сделок для этого статуса не поддерживается.</Notice>{/if}
				{#each impact.warnings ?? [] as w (w)}<Notice class="shrink-0" tone="warning">{w}</Notice>{/each}
			</div>
		{/if}
	{:else if step === 1}
		<div class="flex flex-col gap-4">
			<Pick label={deals > 0 ? 'Перенести сделки в статус' : 'Заменяющий статус'} bind:value={target} items={targetItems} search error={targetItems.length === 0 ? 'Нет подходящих статусов' : undefined} />
			{#if targetStatus?.required_fields.length}
				<p class="t-desc-l -mt-2 text-muted">В целевом статусе обязательны поля: {targetStatus.required_fields.join(', ')}. Сделки без них уйдут в резервный статус.</p>
			{/if}
			{#if deals > 0}
				<Pick label="Резервный статус (необязательно)" bind:value={fallback} items={fallbackItems} clearable search hint="Для сделок, которым не хватает обязательных полей" />
				<RadioField
					label="Срок SLA после переноса"
					value={sla}
					items={SLA_MODES.map((mode) => ({ key: mode, label: SLA_MODE_LABELS[mode].label, hint: SLA_MODE_LABELS[mode].hint }))}
					onChange={(v) => (sla = v as SlaMode)}
				/>
			{/if}
		</div>
	{:else if step === 2}
		<ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-fg">
			<li class="t-body-m">{deals > 0 ? `${count(deals, ['сделка', 'сделки', 'сделок'])} → «${targetName}»` : `Заменяющий статус: «${targetName}»`}</li>
			{#if fallbackName}<li class="t-body-m">Резервный статус: «{fallbackName}»</li>{/if}
			{#if deals > 0}<li class="t-body-m">SLA: {SLA_MODE_LABELS[sla].label.toLowerCase()}</li>{/if}
			<li class="t-body-m">Переходы из статуса и в него останутся в истории сделок</li>
		</ul>
		<Notice class="shrink-0" tone="warning">Действие необратимо: вернуть статус из архива нельзя.</Notice>
	{:else}
		<div class="flex flex-col items-center gap-3 py-4 text-center">
			{#if outcome === null}
				<Progress indeterminate label="Переносим сделки…" class="w-full" />
			{:else if outcome === 'done'}
				<span class="inline-flex size-12 items-center justify-center rounded-full bg-success-soft"><CheckLarge class="size-6 fill-success" /></span>
				<p class="t-body-m">{outcomeText}</p>
			{:else}
				<Notice tone={outcome === 'failed' ? 'error' : 'warning'} class="shrink-0 w-full text-left">{outcomeText}</Notice>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if step === 3}
			<Btn label={outcome === null ? 'Идёт перенос…' : 'Готово'} loading={outcome === null} onclick={onClose} />
		{:else}
			<Btn label={step === 2 ? 'Архивировать' : 'Далее'} danger={step === 2} disabled={!canNext} onclick={next} />
			<Btn label={step === 0 ? 'Отмена' : 'Назад'} variant="secondary" colorScheme="neutral" onclick={() => (step === 0 ? onClose() : (step -= 1))} />
		{/if}
	{/snippet}
</AppModal>
