<script lang="ts">
	// Карточка сделки: шапка с действиями, лента шагов воронки, вкладки (обзор, этапы, обсуждение, файлы, задачи, история, подписание).
	// Вкладка — в адресе (`?tab=`), так ссылки из уведомлений и кнопка «Назад» ведут туда, куда нужно.
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { session } from '$lib/auth/session.svelte';
	import { people } from '$lib/api/people.svelte';
	import { EmptyState, ErrorState, Notice, Page, Skeleton, TabsBar } from '$lib/ui';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import DealSignatures from '$lib/features/signing/DealSignatures.svelte';
	import DealComments from '../../comments/DealComments.svelte';
	import Attachments from '../../files/Attachments.svelte';
	import DealTasks from '../../tasks/DealTasks.svelte';
	import { contactCache, orgCache } from '../../shared/entityCache.svelte';
	import type { AvailableTransition } from '../../types';
	import DealHeader from './DealHeader.svelte';
	import DealHistory from './DealHistory.svelte';
	import DealOverview from './DealOverview.svelte';
	import DealStages from './DealStages.svelte';
	import DealStepper from './DealStepper.svelte';
	import EditDealDrawer from './EditDealDrawer.svelte';
	import ReassignModal from './ReassignModal.svelte';
	import TransitionDialog from './TransitionDialog.svelte';
	import { DealCardState } from './dealCard.svelte';

	let { id }: { id: string } = $props();

	// svelte-ignore state_referenced_locally
	const card = new DealCardState(id);

	onMount(() => void card.load());

	// Шапка показывается, когда пришли названия организации, контакта и ответственного: иначе «…» меняется на длинное название, оно переносится на вторую
	// строку и всё ниже сдвигается (CLS на телефоне). Ждём не дольше 800 мс — медленный ответ не должен держать карточку пустой.
	let namesWaited = $state(false);
	const dealKey = $derived(card.deal?.id);
	$effect(() => {
		const d = untrack(() => card.deal);
		if (!dealKey || !d) return;
		orgCache.ensure([d.organization_id]);
		contactCache.ensure([d.contact_id]);
		people.ensure([d.owner_id]);
		const timer = setTimeout(() => (namesWaited = true), 800);
		return () => clearTimeout(timer);
	});
	const namesReady = $derived.by(() => {
		const d = card.deal;
		if (!d || namesWaited) return true;
		return (!d.organization_id || orgCache.get(d.organization_id) !== undefined) && (!d.contact_id || contactCache.get(d.contact_id) !== undefined) && (!d.owner_id || people.get(d.owner_id) !== undefined);
	});

	const TABS = ['overview', 'stages', 'comments', 'files', 'tasks', 'history', 'signing'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived.by<Tab>(() => {
		const raw = page.url.searchParams.get('tab');
		return (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'overview';
	});
	const setTab = (next: string) => setQuery({ tab: next === 'overview' ? null : next }, { push: true });

	const canSign = $derived(session.canAny('signature:create', 'signature:sign', 'signature:void'));
	const canWrite = $derived(session.can('deal:update') && !card.closed && card.writable);
	const canFiles = $derived(session.can('file:upload') && !card.closed);

	let commentCount = $state<number | null>(null);
	let taskCount = $state<number | null>(null);
	const comments = $derived(commentCount ?? card.counts.comments);
	const tasks = $derived(taskCount ?? card.counts.tasks);
	const signaturePending = $derived(card.deal?.signature_status === 'pending' || card.deal?.signature_status === 'partially_signed');
	const tabs = $derived([
		{ key: 'overview', label: 'Обзор' },
		{ key: 'stages', label: 'Этапы' },
		{ key: 'comments', label: 'Обсуждение', count: comments || undefined },
		{ key: 'files', label: 'Файлы' },
		{ key: 'tasks', label: 'Задачи', count: tasks || undefined },
		{ key: 'history', label: 'История' },
		...(canSign ? [{ key: 'signing', label: 'Подписание', dot: signaturePending }] : [])
	]);

	let dialogFor = $state<AvailableTransition | null>(null);
	let editing = $state(false);
	let reassigning = $state(false);

	// подпись меняет статус сделки не через нас: при уходе с вкладки «Подписание» и при возврате в окно перечитываем сделку
	let previous: Tab = 'overview';
	$effect(() => {
		const now = tab;
		if (previous === 'signing' && now !== 'signing') void card.refresh();
		previous = now;
	});

	function done(deal: NonNullable<typeof card.deal>, transition: AvailableTransition) {
		dialogFor = null;
		void card.applied(deal);
		if (transition.actions?.some((a) => a.type === 'request_signature')) setTab('signing');
	}

	function navigate(target: 'files' | 'signing' | 'tasks' | 'edit') {
		dialogFor = null;
		if (target === 'edit') editing = true;
		else setTab(target);
	}
</script>

<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && card.deal && void card.refresh()} />
<svelte:head><title>{card.deal ? `${card.deal.number} · ${card.deal.title}` : 'Сделка'} · RTK School</title></svelte:head>

<Page>
	{#if (card.loading && !card.deal) || (card.deal && !namesReady)}
		<Skeleton kind="rows" rows={2} />
		<Skeleton rows={1} height={44} radius={22} />
		<Skeleton kind="rows" rows={6} />
	{:else if card.error && !card.deal}
		<ErrorState error={card.error} onRetry={() => card.load()} />
	{:else if card.deal}
		{@const deal = card.deal}
		{#if card.conflict}
			<Notice class="shrink-0" tone="warning" role="alert" actions={[{ label: 'Обновить', onclick: () => card.refresh() }]}>Сделка изменена другим пользователем.</Notice>
		{/if}
		{#if deal.owner_unavailable}
			<Notice class="shrink-0" tone="warning" role="alert" actions={session.can('deal:reassign') ? [{ label: 'Назначить', onclick: () => (reassigning = true) }] : []}>Ответственный недоступен — назначьте нового.</Notice>
		{/if}

		<DealHeader {card} onTransition={(t) => (dialogFor = t)} onEdit={() => (editing = true)} onReassign={() => (reassigning = true)} />
		<DealStepper {card} transitions={session.can('deal:transition') ? card.transitions : []} onStep={(t) => (dialogFor = t)} />
		<TabsBar items={tabs} value={tab} onChange={setTab} label="Разделы сделки" />

		{#if tab === 'overview'}
			<DealOverview {card} />
		{:else if tab === 'stages'}
			<DealStages dealId={deal.id} refreshKey={card.epoch} commentsTotal={comments} />
		{:else if tab === 'comments'}
			<DealComments dealId={deal.id} canWrite={session.can('deal:update') && card.writable} refreshKey={card.epoch} onCount={(n) => (commentCount = n)} />
		{:else if tab === 'files'}
			<Attachments entityType="deal" entityId={deal.id} canEdit={canFiles} about="по сделке" />
		{:else if tab === 'tasks'}
			<DealTasks dealId={deal.id} canWrite={canWrite} refreshKey={card.epoch} onCount={(n) => (taskCount = n)} />
		{:else if tab === 'history'}
			<DealHistory dealId={deal.id} data={card.history} loading={card.historyLoading} error={card.historyError} onRetry={() => card.loadHistory()} />
		{:else if tab === 'signing' && canSign}
			<DealSignatures dealId={deal.id} />
		{:else}
			<EmptyState title="Нет доступа" compact />
		{/if}

		{#if dialogFor}
			<TransitionDialog
				open
				{deal}
				transition={dialogFor}
				graph={card.graph}
				onClose={() => (dialogFor = null)}
				onDone={done}
				onNavigate={navigate}
				onConflict={() => card.refresh()}
				onFilesChanged={async () => {
					// файл приложен или отвязан: условия «файл в сделке» пересчитываются сервером, диалог получает свежий переход
					await card.loadTransitions();
					const id = dialogFor?.id;
					dialogFor = card.transitions.find((t) => t.id === id) ?? dialogFor;
				}}
			/>
		{/if}
		<EditDealDrawer open={editing} {card} onClose={() => (editing = false)} />
		<ReassignModal open={reassigning} {card} onClose={() => (reassigning = false)} />
	{/if}
</Page>
