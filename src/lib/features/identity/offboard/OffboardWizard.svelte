<script lang="ts">
	// Мастер передачи дел и увольнения (new_spec §4.7): что держит сотрудник → преемник и распределение → подтверждение.
	// Преемник по умолчанию получает всё; переключатель «Распределить по вузам» открывает таблицу: вуз целиком или отдельная сделка — другому
	// сотруднику, вузы сотрудника — отдельным блоком (`organization_successors`, одна транзакция на сервере).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { CloseSmall } from '@lct-testkit/rt-ui/icons';
	import { AreaField, CheckField, FormBody, WizardCard, WizardSteps } from '$lib/ui';
	import { ApiError, api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { useLeaveGuard } from '$lib/ui/leave-guard.svelte';
	import { plural } from '$lib/utils/format';
	import { dealsWord, requestsWord, summarizeWorkload, tasksWord, validateOffboard, type WorkloadSummary } from '../offboard';
	import type { OffboardResult, UserOut } from '../types';
	import AllocationTable from './AllocationTable.svelte';
	import {
		buildDealSuccessors,
		buildOrganizationSuccessors,
		emptyChoice,
		groupByOrganization,
		pruneChoice,
		roundRobin,
		staleDealIds,
		summarizeAllocation,
		type AllocationChoice,
		type DealItem,
		type OrgItem
	} from './allocation';

	let { user }: { user: UserOut } = $props();

	const STEPS = ['Дела', 'Преемник и распределение', 'Подтверждение'];

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

	// распределение
	let allocate = $state(false);
	let itemsLoading = $state(false);
	let itemsError = $state<unknown>(null);
	let deals = $state<DealItem[]>([]);
	let orgs = $state<OrgItem[]>([]);
	let choice = $state<AllocationChoice>(emptyChoice());
	let candidateIds = $state<string[]>([]);
	let loads = $state<Record<string, number>>({});
	let stale = $state<Set<string>>(new Set());
	let pickerKey = $state(0);

	const groups = $derived(groupByOrganization(deals));
	const candidates = $derived(candidateIds.map((id) => ({ id, label: loads[id] === undefined ? people.name(id) : `${people.name(id)} · сейчас ${loads[id]}` })));

	// передача дел ещё не выполнена, а выбор или причина уже введены
	useLeaveGuard(() => !result && (step > 0 || !!successorId || !!reason.trim()), 'Передача дел не выполнена, введённое будет потеряно.');

	const body = (mode: 'preview' | 'confirm', extra = {}) => ({ params: { path: { user_id: user.id } }, body: { mode, include_closed_deals: true, include_organizations: true, ...extra } });

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

	/** все сделки или вузы сотрудника постранично: превью отдаёт не больше 20 критичных сделок */
	async function pageAll<T>(kind: 'deals' | 'organizations'): Promise<T[]> {
		const out: T[] = [];
		let cursor: string | undefined;
		for (let i = 0; i < 200; i += 1) {
			const page = await unwrap(api.GET('/api/admin/users/{user_id}/offboard/items', { params: { path: { user_id: user.id }, query: { kind, limit: 100, cursor } } }));
			out.push(...(page.items as T[]));
			if (!page.next_cursor) break;
			cursor = page.next_cursor;
		}
		return out;
	}

	/** BACKEND-BUG: `organization_name` в строках offboard/items приходит пустым даже у сделок с вузом — названия берём из списка сделок сотрудника */
	async function orgNames(): Promise<Map<string, string>> {
		const map = new Map<string, string>();
		let cursor: string | undefined;
		for (let i = 0; i < 200; i += 1) {
			const page = await unwrap(api.GET('/api/deals', { params: { query: { owner_id: [user.id], limit: 100, cursor } } }));
			for (const d of page.items) if (d.organization_name) map.set(d.id, d.organization_name);
			if (!page.next_cursor) break;
			cursor = page.next_cursor;
		}
		return map;
	}

	async function loadItems() {
		itemsLoading = true;
		itemsError = null;
		try {
			const [raw, o, names] = await Promise.all([pageAll<DealItem>('deals'), pageAll<OrgItem>('organizations'), orgNames().catch(() => new Map<string, string>())]);
			const d = raw.map((x) => (x.organization_name ? x : { ...x, organization_name: names.get(x.id) ?? null }));
			deals = d;
			orgs = o;
			choice = pruneChoice(choice, d, o);
			stale = new Set();
		} catch (e) {
			itemsError = e;
		} finally {
			itemsLoading = false;
		}
	}

	function toggleAllocate(on: boolean) {
		allocate = on;
		if (on && !deals.length && !orgs.length) void loadItems();
	}

	async function addCandidate(id: string | null) {
		pickerKey += 1; // поле выбора очищается после добавления
		if (!id || id === successorId || id === user.id || candidateIds.includes(id)) return;
		candidateIds = [...candidateIds, id];
		try {
			const page = await unwrap(api.GET('/api/deals', { params: { query: { owner_id: [id], is_closed: false, limit: 1 } } }));
			loads = { ...loads, [id]: page.total ?? page.items.length };
		} catch {
			// число открытых сделок — подсказка, без него можно обойтись
		}
	}
	function removeCandidate(id: string) {
		candidateIds = candidateIds.filter((c) => c !== id);
		const clean = (src: Record<string, string | null>) => Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v === id ? null : v]));
		choice = { groups: clean(choice.groups), deals: clean(choice.deals), orgs: clean(choice.orgs) };
	}

	/** «Разложить поровну»: вузы целиком по кандидатам (и преемнику по умолчанию — он тоже получает свою долю) */
	function spread() {
		const pool = [...(successorId ? [successorId] : []), ...candidateIds];
		const plan = roundRobin(groups, pool);
		choice = { ...choice, groups: Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v === successorId ? null : v])), deals: {} };
	}
	const resetChoice = () => (choice = emptyChoice());

	const check = $derived(validateOffboard({ userId: user.id, successorId, reason, acknowledged: ack }, step === 2 ? 'confirm' : 'successor'));
	const successor = $derived(successorId ? people.name(successorId) : '');
	const plan = $derived(allocate && successorId ? summarizeAllocation(deals, orgs, choice, successorId) : []);
	$effect(() => people.ensure(plan.map((p) => p.successorId)));

	function next() {
		touched = true;
		if (step === 1 && !check.ok) return;
		touched = false;
		step += 1;
	}

	async function confirmNow() {
		touched = true;
		if (!check.ok || busy || !successorId) return;
		busy = true;
		problem = null;
		const extra =
			allocate && !itemsLoading
				? { deal_successors: buildDealSuccessors(deals, choice, successorId), organization_successors: buildOrganizationSuccessors(orgs, choice, successorId) }
				: {};
		try {
			result = await unwrap(api.POST('/api/admin/users/{user_id}/offboard', body('confirm', { successor_id: successorId, reason: reason.trim(), ...extra })));
		} catch (e) {
			if (e instanceof ApiError && e.isValidation && staleDealIds(e.errors).length) {
				stale = new Set(staleDealIds(e.errors));
				problem = 'Часть сделок уже передали или удалили, пока мастер был открыт. Обновите список — выбор сохранится.';
			} else {
				problem = e instanceof ApiError ? (e.code === 'CRM-1903' ? 'Это последний администратор: сначала назначьте другого.' : e.detail) : 'Не удалось выполнить передачу';
			}
		} finally {
			busy = false;
		}
	}

	async function refreshList() {
		await loadItems();
		problem = null;
	}

	// итог: названия и номера первых 12 переданных сделок
	let resultDeals = $state<Record<string, { number: string; title: string }>>({});
	$effect(() => {
		const ids = result?.reassigned_deals?.slice(0, 12) ?? [];
		if (!ids.length) return;
		void (async () => {
			const found: Record<string, { number: string; title: string }> = {};
			for (let i = 0; i < ids.length; i += 6) {
				await Promise.all(
					ids.slice(i, i + 6).map(async (id) => {
						try {
							const d = (await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: id } } }))).deal;
							found[id] = { number: d.number, title: d.title };
						} catch {
							// название не получили: покажем короткий id
						}
					})
				);
			}
			resultDeals = found;
			people.ensure((result?.distribution ?? []).map((d) => d.successor_id));
		})();
	});
	const orgWord = (n: number) => plural(n, ['вуз', 'вуза', 'вузов']);
</script>

{#if result}
	<!-- итоговая карточка со списком и кнопками, не сообщение: Notice не подходит -->
	<WizardCard role="status" data-testid="offboard-done">
		<h2 class="t-h3 m-0">Дела переданы</h2>
		<p class="t-body-m m-0">{user.full_name} уволен, сессии завершены ({result.sessions_terminated}).</p>
		<ul class="t-body-m m-0 list-none p-0">
			{#if result.distribution?.length}
				{#each result.distribution as d (d.successor_id)}
					<li><b>{people.name(d.successor_id)}</b> — {d.deals} {dealsWord(d.deals)}{#if d.organizations}, {d.organizations} {orgWord(d.organizations)}{/if}{#if d.tasks}, {d.tasks} {tasksWord(d.tasks)}{/if}</li>
				{/each}
			{:else}
				<li>Переназначено {result.reassigned_deals?.length ?? 0} {dealsWord(result.reassigned_deals?.length ?? 0)}; преемник: {successor}</li>
			{/if}
			{#if result.reassigned_organizations?.length}<li>Вузов передано: {result.reassigned_organizations.length}</li>{/if}
			<li>Запросов подписи переадресовано: {result.signature_requests_reassigned}</li>
		</ul>
		{#if result.reassigned_deals?.length}
			<!-- ссылки-пилюли: Chip у rt-ui — кнопка, а здесь нужна настоящая ссылка (новая вкладка, адрес) -->
			<div class="flex flex-wrap gap-2">
				{#each result.reassigned_deals.slice(0, 12) as dealId (dealId)}
					<a class="t-desc-l max-w-full truncate rounded-full border border-line px-2 py-1" href="/deals/{dealId}" title={resultDeals[dealId]?.title}>{resultDeals[dealId] ? `${resultDeals[dealId].number} · ${resultDeals[dealId].title}` : `Сделка ${dealId.slice(-4)}`}</a>
				{/each}
			</div>
			{#if result.reassigned_deals.length > 12}<p class="t-desc-l m-0 text-muted">и ещё {result.reassigned_deals.length - 12}</p>{/if}
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
						{#each [['Сделки', summary.deals], ['Вузы', summary.organizations], ['Задачи', summary.tasks], ['Запросы подписи', summary.signatureRequests], ['Импорты', summary.imports], ['Отчёты', summary.reports]] as [label, count] (label)}
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
							{#if summary.deals > 8}<p class="t-desc-l m-0 text-muted">и ещё {summary.deals - 8} — полный список и распределение на следующем шаге</p>{/if}
						</div>
					{/if}
				{/if}
			{/if}
		{:else if step === 1}
			<FormBody>
				<UserPicker label="Преемник по умолчанию" required roles={['KAM', 'HEAD']} exclude={[user.id]} value={successorId} error={touched ? check.errors.successorId : undefined} onChange={(id) => (successorId = id)} />
				<AreaField label="Причина увольнения" required rows={3} value={reason} error={touched ? check.errors.reason : undefined} maxlength={500} onInput={(v) => (reason = v)} />
				{#if summary && (summary.deals > 0 || summary.organizations > 0)}
					<Toggle label="Распределить по вузам" checked={allocate} onChange={toggleAllocate} hint="Вуз целиком или отдельная сделка — другому сотруднику; остальное уйдёт преемнику по умолчанию" />
				{/if}
			</FormBody>

			{#if allocate}
				<div class="flex flex-col gap-3" data-testid="allocation-panel">
					{#if itemsLoading}
						<Skeleton kind="rows" rows={4} />
					{:else if itemsError}
						<ErrorState error={itemsError} onRetry={loadItems} compact />
					{:else}
						<div class="flex flex-col gap-2">
							{#key pickerKey}
								<UserPicker label="Добавить сотрудника для распределения" roles={['KAM', 'HEAD']} exclude={[user.id, ...(successorId ? [successorId] : []), ...candidateIds]} value={null} placeholder="Кому ещё передать дела" onChange={(id) => void addCandidate(id)} />
							{/key}
							{#if candidates.length}
								<ul class="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="candidates">
									{#each candidates as c (c.id)}
										<li class="t-body-s flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pr-0.5 pl-3">
											<span>{c.label}</span>
											<IconBtn icon={CloseSmall} label={`Убрать: ${c.label}`} size="s" onclick={() => removeCandidate(c.id)} />
										</li>
									{/each}
								</ul>
							{/if}
							<div class="flex flex-wrap gap-2">
								<Btn label="Разложить поровну" size="s" variant="outline" colorScheme="neutral" disabled={!successorId && !candidates.length} onclick={spread} data-testid="alloc-spread" />
								<Btn label="Сбросить" size="s" variant="ghost" colorScheme="neutral" onclick={resetChoice} />
							</div>
						</div>
						{#if successorId}
							<AllocationTable {groups} {orgs} {choice} {candidates} {stale} onChange={(next) => (choice = next)} />
						{:else}
							<Notice class="shrink-0" tone="info">Сначала выберите преемника по умолчанию — с ним сравнивается любой другой выбор.</Notice>
						{/if}
					{/if}
				</div>
			{/if}
		{:else}
			{#if plan.length > 1 || (plan.length === 1 && plan[0].organizations > 0 && allocate)}
				<div class="flex flex-col gap-2" data-testid="allocation-summary">
					{#each plan as p, i (p.successorId)}
						<div class="flex flex-col">
							<p class="t-body-m m-0"><b>{people.name(p.successorId)}</b>{#if i === 0}&nbsp;<span class="text-muted">(по умолчанию)</span>{/if} — {p.deals} {dealsWord(p.deals)}{#if p.organizations}, {p.organizations} {orgWord(p.organizations)}{/if}</p>
							{#if p.groups.length && p.deals}<p class="t-desc-l m-0 text-muted">Сделки вузов: {p.groups.slice(0, 4).join(', ')}{p.groups.length > 4 ? ` и ещё ${p.groups.length - 4}` : ''}</p>{/if}
						</div>
					{/each}
					{#if plan[0]}<p class="t-body-s m-0 text-muted">Задачи и запросы подписи уходят преемнику по умолчанию — {people.name(plan[0].successorId)}.</p>{/if}
				</div>
			{:else}
				<p class="t-body-m m-0">
					{#if summary && !summary.isEmpty}
						Все дела ({summary.deals} {dealsWord(summary.deals)}, {summary.tasks} {tasksWord(summary.tasks)}, {summary.signatureRequests} {requestsWord(summary.signatureRequests)}) перейдут к сотруднику <b>{successor}</b>.
					{:else}
						Сотрудник будет уволен, преемник: <b>{successor}</b>.
					{/if}
				</p>
			{/if}
			<ul class="t-body-s m-0 list-disc pl-5 text-muted">
				<li>{user.full_name} получит статус «Уволен», все его сессии завершатся.</li>
				<li>Запросы подписи по роли переадресуются, персональные — нет: инициатору придёт задача.</li>
			</ul>
			<CheckField label="Понимаю, что действие необратимо" required checked={ack} onChange={(v) => (ack = v)} />
			{#if touched && check.errors.acknowledged}<Notice class="shrink-0" tone="error">{check.errors.acknowledged}</Notice>{/if}
			{#if problem}<Notice class="shrink-0" tone="error" actions={stale.size ? [{ label: 'Обновить список', onclick: () => void refreshList() }] : []}>{problem}</Notice>{/if}
		{/if}
		{#snippet actions()}
			{#if step < 2}
				<Btn label="Далее" disabled={(step === 0 && (loading || !!loadError)) || (step === 1 && allocate && itemsLoading)} onclick={next} data-testid="offboard-next" />
			{:else}
				<Btn label="Подтвердить" danger loading={busy} onclick={confirmNow} data-testid="offboard-confirm" />
			{/if}
			{#if step > 0}<Btn label="Назад" variant="outline" colorScheme="neutral" disabled={busy} onclick={() => ((touched = false), (step -= 1))} />{/if}
		{/snippet}
	</WizardCard>
{/if}
