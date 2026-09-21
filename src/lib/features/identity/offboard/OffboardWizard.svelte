<script lang="ts">
	// Мастер передачи дел и увольнения (new_spec §4.7): что держит сотрудник → преемник и причина → подтверждение.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { AreaField, CheckField, WizardCard, WizardSteps } from '$lib/ui';
	import { ApiError, api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import { dealsWord, requestsWord, summarizeWorkload, tasksWord, validateOffboard, type WorkloadSummary } from '../offboard';
	import type { OffboardResult, UserOut } from '../types';

	let { user }: { user: UserOut } = $props();

	const STEPS = ['Дела', 'Преемник', 'Подтверждение'];

	let step = $state(0);
	let loading = $state(true);
	let loadError = $state<unknown>(null);
	let summary = $state<WorkloadSummary | null>(null);
	let warnings = $state<string[]>([]);
	let successorId = $state<string | null>(null);
	let reason = $state('');
	let ack = $state(false);
	let busy = $state(false);
	let problem = $state<string | null>(null);
	let result = $state<OffboardResult | null>(null);
	let touched = $state(false);

	const body = (mode: 'preview' | 'confirm', extra = {}) => ({ params: { path: { user_id: user.id } }, body: { mode, ...extra } });

	async function preview() {
		loading = true;
		loadError = null;
		try {
			const out = await unwrap(api.POST('/api/admin/users/{user_id}/offboard', body('preview')));
			summary = summarizeWorkload(out.workload);
			warnings = out.warnings ?? [];
		} catch (e) {
			loadError = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void preview());

	const check = $derived(validateOffboard({ userId: user.id, successorId, reason, acknowledged: ack }, step === 2 ? 'confirm' : 'successor'));
	const successor = $derived(successorId ? people.name(successorId) : '');

	function next() {
		touched = true;
		if (step === 1 && !check.ok) return;
		touched = false;
		step += 1;
	}

	async function confirmNow() {
		touched = true;
		if (!check.ok || busy) return;
		busy = true;
		problem = null;
		try {
			result = await unwrap(api.POST('/api/admin/users/{user_id}/offboard', body('confirm', { successor_id: successorId, reason: reason.trim() })));
		} catch (e) {
			problem = e instanceof ApiError ? (e.code === 'CRM-1903' ? 'Это последний администратор: сначала назначьте другого.' : e.detail) : 'Не удалось выполнить передачу';
		} finally {
			busy = false;
		}
	}
</script>

{#if result}
	<!-- итоговая карточка со списком и кнопками, не сообщение: Notice не подходит -->
	<WizardCard role="status" data-testid="offboard-done">
		<h2 class="t-h3 m-0">Дела переданы</h2>
		<p class="t-body-m m-0">
			{user.full_name} уволен, сессии завершены ({result.sessions_terminated}). Преемник: {successor}.
		</p>
		<ul class="t-body-m m-0 list-none p-0">
			<li>Переназначено {result.reassigned_deals?.length ?? 0} {dealsWord(result.reassigned_deals?.length ?? 0)}</li>
			<li>Запросов подписи переадресовано: {result.signature_requests_reassigned}</li>
		</ul>
		{#if result.reassigned_deals?.length}
			<!-- ссылки-пилюли: Chip у rt-ui — кнопка, а здесь нужна настоящая ссылка (новая вкладка, адрес) -->
			<div class="flex flex-wrap gap-2">
				{#each result.reassigned_deals.slice(0, 12) as dealId (dealId)}<a class="t-desc-l rounded-full border border-line px-2 py-1" href="/deals/{dealId}">Сделка {dealId.slice(-4)}</a>{/each}
			</div>
		{/if}
		{#snippet actions()}
			<Btn label="К карточке" onclick={() => goto(`/admin/users/${user.id}`)} />
			<Btn label="К списку" variant="outline" colorScheme="neutral" onclick={() => goto('/admin/users')} />
		{/snippet}
	</WizardCard>
{:else}
	<WizardSteps steps={STEPS} current={step} />

	<WizardCard aria-live="polite">
		{#if step === 0}
			{#if loading}
				<Skeleton kind="rows" rows={4} />
			{:else if loadError}
				<ErrorState error={loadError} onRetry={preview} compact />
			{:else if summary}
				{#if summary.unsupported}
					<Notice class="shrink-0" tone="warning">Модуль сделок недоступен: счётчики могут быть неполными.</Notice>
				{/if}
				{#each warnings as w (w)}<Notice class="shrink-0" tone="warning">{w}</Notice>{/each}
				{#if summary.isEmpty}
					<p class="t-body-m m-0">За сотрудником ничего не числится: можно сразу переходить к увольнению.</p>
				{:else}
					<div class="grid grid-cols-3 gap-3 max-md:grid-cols-2">
						{#each [['Сделки', summary.deals], ['Задачи', summary.tasks], ['Запросы подписи', summary.signatureRequests], ['Импорты', summary.imports], ['Отчёты', summary.reports]] as [label, count] (label)}
							<div class="flex flex-col rounded-md border border-line bg-surface-2 px-3 py-2">
								<span class="t-h3 tabular-nums">{count}</span>
								<span class="t-desc-l text-muted">{label}</span>
							</div>
						{/each}
					</div>
					{#if summary.criticalDeals.length}
						<div class="flex flex-col gap-1">
							<h3 class="t-body-m-strong m-0">Сделки</h3>
							<ul class="m-0 list-none p-0">
								{#each summary.criticalDeals.slice(0, 8) as d (d.id)}
									<li class="flex items-baseline gap-2 border-t border-line py-1.5 first:border-t-0">
										<a class="t-body-s shrink-0" href="/deals/{d.id}">{d.number}</a>
										<span class="t-body-s min-w-0 flex-1 truncate">{d.title}</span>
									</li>
								{/each}
							</ul>
							{#if summary.criticalDeals.length > 8}<p class="t-desc-l m-0 text-muted">и ещё {summary.criticalDeals.length - 8}</p>{/if}
						</div>
					{/if}
				{/if}
			{/if}
		{:else if step === 1}
			<UserPicker label="Преемник" roles={['KAM', 'HEAD']} exclude={[user.id]} value={successorId} error={touched ? check.errors.successorId : undefined} onChange={(id) => (successorId = id)} />
			<AreaField label="Причина увольнения" rows={3} value={reason} error={touched ? check.errors.reason : undefined} maxlength={500} onInput={(v) => (reason = v)} />
		{:else}
			<p class="t-body-m m-0">
				{#if summary && !summary.isEmpty}
					Все дела ({summary.deals} {dealsWord(summary.deals)}, {summary.tasks} {tasksWord(summary.tasks)}, {summary.signatureRequests} {requestsWord(summary.signatureRequests)}) перейдут к сотруднику <b>{successor}</b>.
				{:else}
					Сотрудник будет уволен, преемник: <b>{successor}</b>.
				{/if}
			</p>
			<ul class="t-body-s m-0 list-disc pl-5 text-muted">
				<li>{user.full_name} получит статус «Уволен», все его сессии завершатся.</li>
				<li>Запросы подписи по роли переадресуются, персональные — нет: инициатору придёт задача.</li>
			</ul>
			<CheckField label="Понимаю, что действие необратимо" checked={ack} onChange={(v) => (ack = v)} />
			{#if touched && check.errors.acknowledged}<Notice class="shrink-0" tone="error">{check.errors.acknowledged}</Notice>{/if}
			{#if problem}<Notice class="shrink-0" tone="error">{problem}</Notice>{/if}
		{/if}
		{#snippet actions()}
			{#if step < 2}
				<Btn label="Далее" disabled={step === 0 && (loading || !!loadError)} onclick={next} data-testid="offboard-next" />
			{:else}
				<Btn label="Подтвердить" danger loading={busy} onclick={confirmNow} data-testid="offboard-confirm" />
			{/if}
			{#if step > 0}<Btn label="Назад" variant="outline" colorScheme="neutral" disabled={busy} onclick={() => ((touched = false), (step -= 1))} />{/if}
		{/snippet}
	</WizardCard>
{/if}
