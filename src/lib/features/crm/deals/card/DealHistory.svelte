<script lang="ts">
	// Вкладка «История»: слева таймлайн статусов (откуда, куда, кто, сколько пробыла в прошлом статусе, SLA в момент смены),
	// справа лента событий (создание, смена ответственного, подпись, перенос при изменении воронки).
	import { untrack } from 'svelte';
	import { ArrowRight } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { DateText, EmptyState, ErrorState, Skeleton } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import Ico from '../../shared/Ico.svelte';
	import { formatDurationLong, parseIsoDuration } from '../../shared/duration';
	import { DEAL_EVENT_LABELS, HISTORY_REASON_LABELS, SLA_STATE_LABELS } from '../../shared/labels';
	import type { DealEvent, DealHistory } from '../../types';
	import DealStatusChip from '../DealStatusChip.svelte';
	import { workflows } from '../workflows.svelte';

	let { dealId, workflowId, refreshKey = 0 }: { dealId: string; workflowId: string; refreshKey?: number } = $props();

	let data = $state<DealHistory | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		error = null;
		try {
			await workflows.ensure(workflowId);
			data = await unwrap(api.GET('/api/deals/{deal_id}/history', { params: { path: { deal_id: dealId } } }));
			people.ensure([...data.statuses.map((s) => s.changed_by), ...data.events.map((e) => e.actor_id)]);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void refreshKey;
		untrack(() => void load());
	});

	const statuses = $derived([...(data?.statuses ?? [])].sort((a, b) => b.changed_at.localeCompare(a.changed_at)));
	const events = $derived([...(data?.events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)));

	const who = (payload: Record<string, unknown> | null | undefined, key: string): string => {
		const id = payload?.[key];
		return typeof id === 'string' ? people.name(id) : '—';
	};

	function summary(event: DealEvent): string {
		const p = event.payload ?? {};
		switch (event.event_type) {
			case 'OWNER_CHANGED':
				return `${who(p, 'old_owner_id')} → ${who(p, 'new_owner_id')}${typeof p.reason === 'string' && p.reason ? `. ${p.reason}` : ''}`;
			case 'WORKFLOW_MIGRATION':
				return p.used_fallback ? 'Сделка перенесена в запасной статус' : 'Сделка перенесена в другой статус';
			default:
				return '';
		}
	}
</script>

{#if loading}
	<Skeleton kind="rows" rows={5} />
{:else if error}
	<ErrorState {error} onRetry={load} compact />
{:else}
	<div class="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4 max-lg:grid-cols-1">
		<Card title="Статусы">
			{#if statuses.length === 0}
				<EmptyState title="Смен статуса не было" compact />
			{:else}
				<ol class="m-0 flex list-none flex-col gap-0 p-0" data-testid="status-timeline">
					{#each statuses as change (change.id)}
						{@const spent = parseIsoDuration(change.duration_in_prev)}
						<li class="relative flex flex-col gap-1 border-l-2 border-line pb-4 pl-4 last:border-l-transparent last:pb-0">
							<span class="absolute top-1.5 -left-[5px] size-2 rounded-full bg-accent" aria-hidden="true"></span>
							<div class="flex flex-wrap items-center gap-2">
								{#if change.from_status_id}
									<DealStatusChip statusId={change.from_status_id} />
									<Ico icon={ArrowRight} tone="soft" size={16} />
								{/if}
								<DealStatusChip statusId={change.to_status_id} />
							</div>
							<span class="t-desc-l flex flex-wrap gap-x-3 text-muted">
								<DateText value={change.changed_at} time />
								<span>{people.name(change.changed_by, 'Система')}</span>
								{#if change.reason !== 'manual'}<span>{HISTORY_REASON_LABELS[change.reason] ?? change.reason}</span>{/if}
								{#if spent !== null && change.from_status_id}<span>в прошлом статусе: {formatDurationLong(spent)}</span>{/if}
								{#if change.sla_state_at_change === 'warning' || change.sla_state_at_change === 'breached'}
									<span class={change.sla_state_at_change === 'breached' ? 'text-danger' : 'text-warning'}>SLA: {SLA_STATE_LABELS[change.sla_state_at_change]}</span>
								{/if}
							</span>
							{#if change.comment}<p class="t-body-m m-0 rounded-sm bg-surface-3 px-3 py-2 break-words">{change.comment}</p>{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</Card>

		<Card title="События">
			{#if events.length === 0}
				<EmptyState title="Событий нет" compact />
			{:else}
				<ul class="m-0 flex list-none flex-col gap-3 p-0">
					{#each events as event (event.id)}
						<li class="flex flex-col gap-0.5">
							<span class="t-body-m-strong">{DEAL_EVENT_LABELS[event.event_type] ?? event.event_type}</span>
							{#if summary(event)}<span class="t-body-m break-words">{summary(event)}</span>{/if}
							<span class="t-desc-l flex flex-wrap gap-x-3 text-muted"><DateText value={event.created_at} time /><span>{people.name(event.actor_id, 'Система')}</span></span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>
{/if}
