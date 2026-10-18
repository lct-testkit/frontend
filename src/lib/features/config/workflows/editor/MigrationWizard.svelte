<script lang="ts">
	// «Перенести сделки со старых шагов»: одна таблица «Старый шаг → Новый шаг» со счётчиком сделок по каждой строке, проверка и выполнение строк по одной
	// (в порядке `planOrder`: цель ещё не в архиве). Каждая строка — обычная архивация статуса (`POST …/statuses/{id}/archive`) с ожиданием задачи переноса;
	// после неё граф перечитывается (версия воронки растёт), и только потом идёт следующая строка. Ошибка останавливает остальные, есть «Продолжить».
	// Правила по условиям (`mapping_rules`) здесь не показываются: бэкенд их хранит, но пока не применяет.
	import { untrack } from 'svelte';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge, AttentionMark } from '@lct-testkit/rt-ui/icons';
	import { api, errorTextWithCode, ifMatch, unwrap } from '$lib/api';
	import { Btn, ErrorState, Notice, Skeleton, WizardSteps } from '$lib/ui';
	import AppModal from '$lib/ui/AppModal.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { count } from '$lib/utils/format';
	import { runLimited } from '../../../crm/deals/list/boardColumns';
	import { planOrder, type MigrationRow } from '../migrationPlan';
	import type { WorkflowEditor } from './editor.svelte';

	interface Props {
		editor: WorkflowEditor;
		open: boolean;
		onClose: () => void;
	}

	let { editor, open, onClose }: Props = $props();

	const STEPS = ['Таблица', 'Проверка', 'Выполнение'];
	const DEALS = ['сделка', 'сделки', 'сделок'] as [string, string, string];
	let step = $state(0);
	let counts = $state<Record<string, number | null>>({});
	let loading = $state(true);
	let error = $state<unknown>(null);
	/** выбранный новый шаг по id старого */
	let targets = $state<Record<string, string | null>>({});
	let checked = $state(false);
	type RowState = 'wait' | 'run' | 'done' | 'failed';
	let progress = $state<Record<string, { state: RowState; text: string }>>({});
	let running = $state(false);
	let failed = $state(false);
	let queue: MigrationRow[] = [];

	// строки: все живые сохранённые статусы; начальный в таблице есть, но не переносится (подсказка)
	const rows = $derived(editor.liveStatuses.filter((s) => s.id));
	const initialId = $derived(rows.find((s) => s.type === 'initial')?.id ?? null);
	const nameOf = (id: string) => editor.liveStatuses.find((s) => s.id === id)?.name ?? '—';
	const chosen = $derived<MigrationRow[]>(rows.flatMap((s) => (targets[s.id as string] ? [{ from: s.id as string, to: targets[s.id as string] as string, initial: s.type === 'initial' }] : [])));
	const plan = $derived(planOrder(chosen));
	const planError = $derived(chosen.length === 0 ? 'Выберите хотя бы одну строку' : plan.ok ? null : plan.error);
	const total = $derived(chosen.reduce((n, r) => n + (counts[r.from] ?? 0), 0));

	$effect(() => {
		if (!open) return;
		untrack(() => {
			step = 0;
			counts = {};
			targets = {};
			checked = false;
			progress = {};
			running = false;
			failed = false;
			void loadCounts();
		});
	});

	async function loadCounts() {
		loading = true;
		error = null;
		try {
			await runLimited(
				rows.map((s) => async () => {
					try {
						counts[s.id as string] = (await unwrap(api.GET('/api/workflows/{workflow_id}/statuses/{status_id}/impact', { params: { path: { workflow_id: editor.id, status_id: s.id as string } } }))).active_count;
					} catch {
						counts[s.id as string] = null;
					}
				}),
				6
			);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	/** Одна строка: архивация статуса с переносом сделок и ожидание задачи (до 3 минут). Возвращает текст ошибки или null. */
	async function archiveRow(row: MigrationRow): Promise<string | null> {
		if (!editor.workflow) return 'Воронка не загружена';
		try {
			const res = await unwrap(
				api.POST('/api/workflows/{workflow_id}/statuses/{status_id}/archive', {
					params: { path: { workflow_id: editor.id, status_id: row.from } },
					body: { target_status_id: row.to, sla_mode: 'recalculate' },
					headers: ifMatch(editor.workflow.version)
				})
			);
			let status: string = res.job_status;
			for (let waited = 0; (status === 'pending' || status === 'running') && res.job_id && waited < 180; waited += 2) {
				await sleep(2000);
				const job = await unwrap(api.GET('/api/workflows/{workflow_id}/mapping-jobs/{job_id}', { params: { path: { workflow_id: editor.id, job_id: res.job_id } } }));
				status = job.status;
				if (job.status === 'failed') return job.error || 'Перенос сделок не удался';
			}
			if (status === 'failed') return 'Перенос сделок не удался';
			if (status !== 'completed') return 'Перенос ещё идёт в фоне — дождитесь и нажмите «Продолжить»';
			await editor.load(true);
			return null;
		} catch (e) {
			return errorTextWithCode(e);
		}
	}

	async function drain() {
		running = true;
		failed = false;
		while (queue.length) {
			const row = queue[0];
			progress[row.from] = { state: 'run', text: 'Переносим…' };
			const problem = await archiveRow(row);
			if (problem) {
				progress[row.from] = { state: 'failed', text: problem };
				failed = true;
				break;
			}
			progress[row.from] = { state: 'done', text: counts[row.from] ? `Перенесено ${count(counts[row.from] as number, DEALS)}` : 'В архиве' };
			queue.shift();
		}
		running = false;
	}

	function start() {
		if (!plan.ok) return;
		queue = [...plan.order];
		progress = Object.fromEntries(plan.order.map((r) => [r.from, { state: 'wait' as RowState, text: 'Ждёт очереди' }]));
		step = 2;
		void drain();
	}

	const finished = $derived(step === 2 && !running && !failed);
	const canNext = $derived(step === 0 ? !loading && !error && !planError : step === 1 ? checked : false);
</script>

<AppModal {open} title="Перенос сделок со старых шагов" size="l" dismissible={!running} dirty={step === 1 || (step === 0 && chosen.length > 0)} {onClose}>
	<WizardSteps steps={STEPS} current={step} compact />

	{#if step === 0}
		{#if error}
			<ErrorState {error} onRetry={loadCounts} compact />
		{:else if loading}
			<Skeleton kind="lines" rows={6} />
		{:else}
			<div class="flex flex-col gap-3">
				<p class="t-body-m m-0 text-muted">Для каждого старого шага выберите новый: сделки перейдут в него, а старый шаг уйдёт в архив. Остальные строки оставьте пустыми.</p>
				<ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="migration-rows">
					{#each rows as s (s.key)}
						{@const id = s.id as string}
						<li class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface p-2.5 max-md:grid-cols-1">
							<span class="flex min-w-0 flex-col">
								<span class="t-body-m wrap-anywhere">{s.name}</span>
								<span class="t-desc-l text-muted">{counts[id] === null ? 'сделки не посчитаны' : count(counts[id] ?? 0, DEALS)}</span>
							</span>
							{#if id === initialId}
								<span class="t-desc-l text-soft">Начальный статус не архивируется — переименуйте его в шаг 1</span>
							{:else}
								<Pick
									value={targets[id] ?? null}
									placeholder="Не переносить"
									clearable
									search
									items={rows.filter((x) => x.key !== s.key).map((x) => ({ key: x.id as string, value: x.name }))}
									onChange={(v) => (targets[id] = v)}
								/>
							{/if}
						</li>
					{/each}
				</ul>
				{#if planError && chosen.length}<Notice class="shrink-0" tone="error">{planError}</Notice>{/if}
			</div>
		{/if}
	{:else if step === 1 && plan.ok}
		<div class="flex flex-col gap-3">
			<ol class="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-fg" data-testid="migration-plan">
				{#each plan.order as r (r.from)}
					<li class="t-body-m">«{nameOf(r.from)}» → «{nameOf(r.to)}»: {counts[r.from] === null ? 'сделки не посчитаны' : count(counts[r.from] ?? 0, DEALS)}</li>
				{/each}
			</ol>
			<p class="t-body-m m-0">Всего сделок к переносу: <b>{total}</b>. Строки выполняются по одной в таком порядке; переходы остаются в истории сделок.</p>
			<Notice class="shrink-0" tone="warning">Действие необратимо: старые шаги уйдут в архив, вернуть их нельзя. Рекомендуем сначала проверить таблицу на копии базы.</Notice>
			<CheckField label="Я проверил таблицу" required bind:checked />
		</div>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite" data-testid="migration-progress">
			{#each Object.entries(progress) as [id, p] (id)}
				<li class="flex items-center gap-3 rounded-md border border-line bg-surface p-2.5">
					<span class="inline-flex size-6 flex-none items-center justify-center">
						{#if p.state === 'done'}<CheckLarge class="size-5 fill-success" />{:else if p.state === 'failed'}<AttentionMark class="size-5 fill-danger" />{:else if p.state === 'run'}<Progress indeterminate label="" class="w-6" />{/if}
					</span>
					<span class="flex min-w-0 flex-col">
						<span class="t-body-m wrap-anywhere">{nameOf(id)}</span>
						<span class={['t-desc-l', p.state === 'failed' ? 'text-danger' : 'text-muted']}>{p.text}</span>
					</span>
				</li>
			{/each}
		</ul>
		{#if finished}<Notice class="shrink-0" tone="success">Готово: старые шаги в архиве, сделки на новых шагах.</Notice>{/if}
	{/if}

	{#snippet footer()}
		{#if step === 2}
			{#if failed}<Btn label="Продолжить" onclick={() => void drain()} data-testid="migration-continue" />{/if}
			<Btn label={running ? 'Идёт перенос…' : 'Закрыть'} loading={running} variant={failed ? 'secondary' : 'primary'} colorScheme={failed ? 'neutral' : 'accent'} onclick={onClose} />
		{:else}
			<Btn label={step === 1 ? 'Перенести' : 'Далее'} danger={step === 1} disabled={!canNext} onclick={() => (step === 1 ? start() : (step = 1))} data-testid="migration-next" />
			<Btn label={step === 0 ? 'Отмена' : 'Назад'} variant="secondary" colorScheme="neutral" onclick={() => (step === 0 ? onClose() : (step = 0))} />
		{/if}
	{/snippet}
</AppModal>
