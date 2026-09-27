<script lang="ts">
	// Исходящие события — журнал доставки: что и куда отправлялось, сколько попыток, чем закончилось. Сами события не редактируются; для «Ошибка» и «Не доставлено»
	// есть одно действие — «Повторить доставку» (POST …/retry, только ADMIN): событие возвращается в очередь.
	import { untrack } from 'svelte';
	import { Refresh, Send } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { DateText, FilterBar, IconBtn, Notice, StatusChip, TableCell, toast, type Col } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { OUTBOX_STATUSES, labelOf } from '../labels';
	import type { OutboxEvent } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import CatalogList from '../catalog/CatalogList.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { LIMITS } from './limits';
	import { outboxHint } from '../hints';

	const status = $derived(readQuery('status') || null);
	const limit = $derived(Number(readQuery('limit')) || 100);
	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/outbox-events', { params: { query: { status, limit } }, signal })).then((r) => r as OutboxEvent[]));
	$effect(() => {
		void [status, limit];
		untrack(() => void list.reload());
	});

	let busy = $state<string | null>(null);
	const retryable = (e: OutboxEvent) => e.status === 'failed' || e.status === 'dead';
	async function retry(e: OutboxEvent) {
		if (busy) return;
		busy = e.id;
		try {
			const saved = await unwrap(api.POST('/api/admin/integrations/outbox-events/{event_id}/retry', { params: { path: { event_id: e.id } } }));
			list.set((list.data ?? []).map((x) => (x.id === saved.id ? (saved as OutboxEvent) : x)));
			toast.success('Событие вернулось в очередь, доставка на ближайшем цикле');
		} catch (err) {
			toast.error(err);
		} finally {
			busy = null;
		}
	}

	// коды last_error, которые пишет бэкенд, — по-русски; незнакомый код показываем как есть
	const ERRORS: Record<string, string> = { source_inactive: 'Источник отключён', source_not_found: 'Источник удалён', timeout: 'Нет ответа от системы', connection_error: 'Не удалось соединиться' };
	const errorText = (code: string) => ERRORS[code] ?? code;
	const tone = (s: string) => (s === 'sent' ? 'success' : s === 'dead' ? 'error' : s === 'failed' ? 'warning' : 'neutral');
	const columns: Col<OutboxEvent>[] = [
		{ key: 'event', title: 'Событие', width: 'minmax(200px, 1.4fr)', render: eventCell },
		{ key: 'target', title: 'Куда', drop: 3, render: targetCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'attempts', title: 'Попыток', align: 'right', drop: 2, render: attemptsCell },
		{ key: 'when', title: 'Создано', render: whenCell },
		{ key: 'err', title: 'Ошибка', width: 'minmax(180px, 1.4fr)', drop: 1, render: errorCell },
		{ key: 'act', title: '', width: 56, align: 'right', render: actionCell }
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
			<StatusChip label={labelOf(OUTBOX_STATUSES, e.status)} tone={tone(e.status)} hint={outboxHint(e.status)} />
			{#if e.next_retry_at && e.status !== 'sent'}<span class="t-desc-m text-soft">повтор <DateText value={e.next_retry_at} time /></span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet attemptsCell(e: OutboxEvent)}<TableCell align="right"><span class="t-body-s tabular-nums">{e.attempts}</span></TableCell>{/snippet}
{#snippet whenCell(e: OutboxEvent)}<TableCell><span class="t-body-s"><DateText value={e.created_at} time /></span></TableCell>{/snippet}
{#snippet errorCell(e: OutboxEvent)}<TableCell>{#if e.last_error}<span class="t-desc-l line-clamp-2 text-danger" title={e.last_error}>{errorText(e.last_error)}</span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet retryBtn(e: OutboxEvent)}
	{#if retryable(e)}<IconBtn icon={Send} label="Повторить доставку" disabled={busy !== null} onclick={() => retry(e)} />{/if}
{/snippet}
{#snippet actionCell(e: OutboxEvent)}<TableCell align="right">{@render retryBtn(e)}</TableCell>{/snippet}

{#snippet card(e: OutboxEvent)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2"><span class="t-body-m-strong wrap-anywhere">{e.event_type}</span><StatusChip label={labelOf(OUTBOX_STATUSES, e.status)} tone={tone(e.status)} hint={outboxHint(e.status)} /></div>
		<span class="t-desc-l text-muted"><DateText value={e.created_at} time /> · попыток: {e.attempts}{e.target ? ` · ${e.target}` : ''}</span>
		{#if e.last_error}<span class="t-desc-l line-clamp-3 text-danger wrap-anywhere">{errorText(e.last_error)}</span>{/if}
		{#if retryable(e)}<div class="flex justify-end">{@render retryBtn(e)}</div>{/if}
	</div>
{/snippet}

{#snippet filters()}
	<Pick label="Статус" clearable placeholder="Любой" value={status} items={OUTBOX_STATUSES.map((s) => ({ key: s.key, value: s.value }))} onChange={(v) => setQuery({ status: v })} />
	<Pick label="Показывать" value={String(limit)} items={LIMITS.map((n) => ({ key: String(n), value: `Последние ${n}` }))} onChange={(v) => setQuery({ limit: v === '100' ? null : v })} />
{/snippet}
{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" onclick={() => list.reload()} />{/snippet}

<Notice class="shrink-0" tone="info">Журнал сообщений, которые система отправляет во внешние системы. События здесь не редактируются; если доставка не удалась, устраните причину и нажмите «Повторить доставку».</Notice>
<FilterBar active={status ? 1 : 0} onReset={() => setQuery({ status: null })} {filters} {trailing} />
<CatalogList rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} filtered={Boolean(status)} emptyText="Исходящих событий нет" ariaLabel="Исходящие события" />
