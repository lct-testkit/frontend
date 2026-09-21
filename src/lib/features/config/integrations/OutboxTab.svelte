<script lang="ts">
	// Исходящие события: что и куда отправлялось, сколько попыток, чем закончилось. «Не доставлено» (dead) — красным. Повторной отправки у бэкенда нет.
	import { untrack } from 'svelte';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { DateText, FilterBar, IconBtn, StatusChip, TableCell, type Col } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { OUTBOX_STATUSES, labelOf } from '../labels';
	import type { OutboxEvent } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import CatalogList from '../catalog/CatalogList.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { LIMITS } from './limits';

	const status = $derived(readQuery('status') || null);
	const limit = $derived(Number(readQuery('limit')) || 100);
	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/outbox-events', { params: { query: { status, limit } }, signal })).then((r) => r as OutboxEvent[]));
	$effect(() => {
		void [status, limit];
		untrack(() => void list.reload());
	});

	const tone = (s: string) => (s === 'sent' ? 'success' : s === 'dead' ? 'error' : s === 'failed' ? 'warning' : 'neutral');
	const columns: Col<OutboxEvent>[] = [
		{ key: 'event', title: 'Событие', width: 'minmax(200px, 1.4fr)', render: eventCell },
		{ key: 'target', title: 'Куда', drop: 3, render: targetCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'attempts', title: 'Попыток', align: 'right', drop: 2, render: attemptsCell },
		{ key: 'when', title: 'Создано', render: whenCell },
		{ key: 'err', title: 'Ошибка', width: 'minmax(180px, 1.4fr)', drop: 1, render: errorCell }
	];
</script>

{#snippet eventCell(e: OutboxEvent)}
	<TableCell>
		<span class="flex min-w-0 flex-col"><span class="t-body-m-strong wrap-anywhere">{e.event_type}</span><span class="t-desc-m font-mono text-soft">{e.aggregate_type} · {e.aggregate_id.slice(-6)}</span></span>
	</TableCell>
{/snippet}
{#snippet targetCell(e: OutboxEvent)}<TableCell><span class="t-body-s">{e.target ?? '—'}</span></TableCell>{/snippet}
{#snippet statusCell(e: OutboxEvent)}
	<TableCell>
		<span class="flex flex-col gap-0.5">
			<StatusChip label={labelOf(OUTBOX_STATUSES, e.status)} tone={tone(e.status)} />
			{#if e.next_retry_at && e.status !== 'sent'}<span class="t-desc-m text-soft">повтор <DateText value={e.next_retry_at} time /></span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet attemptsCell(e: OutboxEvent)}<TableCell align="right"><span class="t-body-s tabular-nums">{e.attempts}</span></TableCell>{/snippet}
{#snippet whenCell(e: OutboxEvent)}<TableCell><span class="t-body-s"><DateText value={e.created_at} time /></span></TableCell>{/snippet}
{#snippet errorCell(e: OutboxEvent)}<TableCell>{#if e.last_error}<span class="t-desc-l line-clamp-2 text-danger" title={e.last_error}>{e.last_error}</span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}

{#snippet card(e: OutboxEvent)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2"><span class="t-body-m-strong wrap-anywhere">{e.event_type}</span><StatusChip label={labelOf(OUTBOX_STATUSES, e.status)} tone={tone(e.status)} /></div>
		<span class="t-desc-l text-muted"><DateText value={e.created_at} time /> · попыток: {e.attempts}{e.target ? ` · ${e.target}` : ''}</span>
		{#if e.last_error}<span class="t-desc-l line-clamp-3 text-danger wrap-anywhere">{e.last_error}</span>{/if}
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Статус" clearable placeholder="Любой" value={status} items={OUTBOX_STATUSES.map((s) => ({ key: s.key, value: s.value }))} onChange={(v) => setQuery({ status: v })} />
	<Pick label="Показывать" value={String(limit)} items={LIMITS.map((n) => ({ key: String(n), value: `Последние ${n}` }))} onChange={(v) => setQuery({ limit: v === '100' ? null : v })} />
{/snippet}
{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => list.reload()} />{/snippet}

<FilterBar active={status ? 1 : 0} onReset={() => setQuery({ status: null })} {filters} {trailing} />
<CatalogList rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} filtered={Boolean(status)} emptyText="Исходящих событий нет" ariaLabel="Исходящие события" />
