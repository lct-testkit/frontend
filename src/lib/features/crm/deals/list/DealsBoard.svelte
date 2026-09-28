<script lang="ts">
	// Доска сделок по статусам воронки. Данные: страницы GET /deals?workflow_id=… (до 500 сделок), группировка на клиенте
	// (группировка и счётчики на клиенте: `total` и фильтр по статусам бэкенд отдаёт с 25.09, backend-issues A-11, но доска их пока не использует). Перетаскивание карточки в другую колонку
	// открывает тот же диалог перехода, что и в карточке сделки; телефон — горизонтальная лента колонок со «снапом».
	import { Counter } from '@lct-testkit/rt-ui';
	import { people } from '$lib/api/people.svelte';
	import { api, unwrap } from '$lib/api';
	import { Avatar, EmptyState, ErrorState, Money, Skeleton, toast } from '$lib/ui';
	import PriorityChip from '../../shared/PriorityChip.svelte';
	import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import type { AvailableTransition, Deal, WorkflowStatus } from '../../types';
	import TransitionDialog from '../card/TransitionDialog.svelte';
	import { isTerminal, statusName, statusTone, steps, terminals, type StatusTone } from '../statusUtils';
	import { workflows } from '../workflows.svelte';
	import type { DealQuery } from './dealFilters';

	interface Props {
		workflowId: string;
		query: DealQuery;
	}

	let { workflowId, query }: Props = $props();

	const MAX_PAGES = 5;
	let deals = $state<Deal[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let truncated = $state(false);
	let seq = 0;

	const graph = $derived(workflows.graph(workflowId));
	const columns = $derived([...steps(graph), ...terminals(graph)]);
	const byStatus = $derived.by(() => {
		const map = new Map<string, Deal[]>();
		for (const deal of deals) {
			const list = map.get(deal.status_id);
			if (list) list.push(deal);
			else map.set(deal.status_id, [deal]);
		}
		return map;
	});

	export async function reload(): Promise<void> {
		const mine = ++seq;
		loading = true;
		error = null;
		try {
			await workflows.ensure(workflowId);
			const all: Deal[] = [];
			let cursor: string | undefined;
			let more = false;
			for (let i = 0; i < MAX_PAGES; i += 1) {
				const page = await unwrap(api.GET('/api/deals', { params: { query: { ...query, status_id: undefined, workflow_id: workflowId, limit: 100, cursor } } }));
				all.push(...page.items);
				more = !!page.next_cursor;
				if (!page.next_cursor) break;
				cursor = page.next_cursor;
			}
			if (mine !== seq) return;
			deals = all;
			truncated = more;
		} catch (e) {
			if (mine === seq) error = e;
		} finally {
			if (mine === seq) loading = false;
		}
	}

	$effect(() => {
		JSON.stringify(query);
		void workflowId;
		void reload();
	});

	$effect(() => {
		people.ensure(deals.map((d) => d.owner_id));
	});

	const TOP: Record<StatusTone, string> = {
		neutral: 'border-t-neutral',
		accent: 'border-t-accent',
		info: 'border-t-info',
		success: 'border-t-success',
		warning: 'border-t-warning',
		error: 'border-t-danger'
	};

	// organization_name/contact_name — бэкенд отдаёт их прямо в DealOut (backend-issues A-29);
	// раньше здесь был N+1 через orgCache/contactCache только чтобы узнать то же самое.
	const party = (d: Deal) => d.organization_name ?? d.contact_name ?? '';

	// --- перетаскивание -> диалог перехода
	let dragId = $state<string | null>(null);
	let overStatus = $state<string | null>(null);
	let dialog = $state<{ deal: Deal; transition: AvailableTransition } | null>(null);

	async function drop(target: WorkflowStatus) {
		const deal = deals.find((d) => d.id === dragId);
		dragId = null;
		overStatus = null;
		if (!deal || deal.status_id === target.id) return;
		try {
			const { items } = await unwrap(api.GET('/api/deals/{deal_id}/available-transitions', { params: { path: { deal_id: deal.id } } }));
			const transition = items.find((t) => t.to_status_id === target.id);
			if (!transition) toast.warning(`Из этого статуса нельзя перейти в «${target.name}»`);
			else dialog = { deal, transition };
		} catch (e) {
			toast.error(e, 'Не удалось проверить переход');
		}
	}

	function moved(updated: Deal) {
		deals = deals.map((d) => (d.id === updated.id ? updated : d));
		dialog = null;
	}
</script>

{#snippet dealCard(deal: Deal)}
	<a
		href="/deals/{deal.id}"
		draggable="true"
		class={[
			'flex min-w-0 cursor-grab flex-col gap-1.5 rounded-md border border-line bg-surface p-3 text-fg no-underline shadow-s transition hover:border-accent hover:no-underline active:cursor-grabbing',
			dragId === deal.id && 'opacity-40'
		]}
		ondragstart={(e) => {
			dragId = deal.id;
			e.dataTransfer?.setData('text/plain', deal.id);
		}}
		ondragend={() => {
			dragId = null;
			overStatus = null;
		}}
	>
		<span class="flex items-center justify-between gap-2">
			<span class="t-desc-l text-muted">{deal.number}</span>
			<PriorityChip priority={deal.priority} hideNormal />
		</span>
		<span class="t-body-m-strong line-clamp-2 break-words">{deal.title}</span>
		<span class="t-desc-l truncate text-muted">{party(deal)}</span>
		<span class="flex min-w-0 items-center justify-between gap-2">
			<span class="t-body-s-strong min-w-0 truncate"><Money value={deal.amount} currency={deal.currency} short /></span>
			<span class="min-w-0 flex-none"><SlaIndicator {deal} compact /></span>
		</span>
		<span class="t-desc-l flex items-center gap-1.5 text-muted">
			<Avatar name={people.name(deal.owner_id)} size={24} />
			<span class="truncate">{people.name(deal.owner_id)}</span>
		</span>
	</a>
{/snippet}

{#if error}
	<ErrorState {error} onRetry={reload} />
{:else if loading && deals.length === 0}
	<div class="flex gap-3 overflow-hidden">
		<div class="w-72 flex-none"><Skeleton kind="tile" rows={4} height={88} /></div>
		<div class="w-72 flex-none max-md:hidden"><Skeleton kind="tile" rows={3} height={88} /></div>
	</div>
{:else if !graph}
	<EmptyState title="Воронка не найдена" compact />
{:else}
	{#if truncated}<p class="t-desc-l m-0 text-muted">Показаны первые {deals.length} сделок — уточните фильтры</p>{/if}
	<div class="-mx-3 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-3 pb-3 md:mx-0 md:min-h-0 md:flex-1 md:snap-none md:items-stretch md:px-0" aria-busy={loading || undefined}>
		{#each columns as status (status.id)}
			{@const list = byStatus.get(status.id) ?? []}
			{@const tone = statusTone(status.type)}
			<section
				class={[
					'flex w-[86vw] max-w-80 flex-none snap-center flex-col rounded-lg border border-t-[3px] border-line bg-surface-2 md:min-h-0 md:w-72',
					TOP[tone],
					overStatus === status.id && dragId && 'ring-2 ring-accent'
				]}
				style:border-top-color={status.color ?? undefined}
				ondragover={(e) => {
					if (dragId) {
						e.preventDefault();
						overStatus = status.id;
					}
				}}
				ondragleave={() => (overStatus = overStatus === status.id ? null : overStatus)}
				ondrop={(e) => {
					e.preventDefault();
					void drop(status);
				}}
				aria-label={statusName(status.name)}
			>
				<header class="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
					<h3 class="t-body-s-strong m-0 truncate" title={statusName(status.name)}>{statusName(status.name)}</h3>
					<Counter size="xs" variant="ghost" colorScheme="neutral">{list.length}</Counter>
				</header>
				<div class={['flex min-h-16 flex-col gap-2 overflow-y-auto p-2 pt-1 max-md:max-h-[62dvh] md:min-h-0 md:flex-1', isTerminal(status) && 'opacity-90']}>
					{#each list as deal (deal.id)}{@render dealCard(deal)}{:else}
						<p class="t-desc-l m-0 py-3 text-center text-soft">Пусто</p>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}

{#if dialog}
	<TransitionDialog open deal={dialog.deal} transition={dialog.transition} {graph} onClose={() => (dialog = null)} onDone={(updated) => moved(updated)} />
{/if}
