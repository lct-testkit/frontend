<script lang="ts">
	// Доставки одной webhook-подписки: что отправлялось, чем закончилось, повтор для «Ошибка» и «Не доставлено».
	import { untrack } from 'svelte';
	import { Refresh, Send } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { AppDrawer, DataTable, DateText, IconBtn, StatusChip, TableCell, toast, type Col } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { OUTBOX_STATUSES, labelOf } from '../labels';
	import { outboxHint } from '../hints';
	import type { WebhookDelivery, WebhookSubscription } from '../types';
	import { PAGE_SIZE, cursorPage } from './cursorPage';
	import { deliveryErrorText, eventTitle } from './subscriptions';

	interface Props {
		subscription: WebhookSubscription | null;
		onClose: () => void;
	}

	let { subscription, onClose }: Props = $props();

	let status = $state<string | null>(null);
	const list = createPager<WebhookDelivery>((cursor, signal) =>
		cursorPage(api.GET('/api/admin/integrations/webhooks/{subscription_id}/deliveries', { params: { path: { subscription_id: subscription?.id ?? '' }, query: { status, limit: PAGE_SIZE, cursor } }, signal }))
	);
	$effect(() => {
		if (!subscription) return;
		void [subscription.id, status];
		untrack(() => void list.reload());
	});
	// у каждой подписки свой журнал: фильтр не переходит на следующую
	$effect(() => {
		if (!subscription) untrack(() => (status = null));
	});

	let busy = $state<string | null>(null);
	const retryable = (d: WebhookDelivery) => d.status === 'failed' || d.status === 'dead';
	async function retry(d: WebhookDelivery) {
		if (busy) return;
		busy = d.id;
		try {
			const saved = await unwrap(api.POST('/api/admin/integrations/webhooks/deliveries/{delivery_id}/retry', { params: { path: { delivery_id: d.id } } }));
			list.patch((x) => x.id === saved.id, saved);
			toast.success('Доставка вернулась в очередь и уйдёт на ближайшем цикле');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	const tone = (s: string) => (s === 'sent' ? 'success' : s === 'dead' ? 'error' : s === 'failed' ? 'warning' : 'neutral');
	const columns: Col<WebhookDelivery>[] = [
		{ key: 'event', title: 'Событие', width: 'minmax(180px, 1.4fr)', render: eventCell },
		{ key: 'status', title: 'Статус', render: statusCell },
		{ key: 'attempts', title: 'Попыток', align: 'right', drop: 2, render: attemptsCell },
		{ key: 'when', title: 'Создано', drop: 1, render: whenCell },
		{ key: 'err', title: 'Ошибка', width: 'minmax(160px, 1.2fr)', drop: 3, render: errorCell },
		{ key: 'act', title: '', width: 56, align: 'right', render: actionCell }
	];
</script>

{#snippet eventCell(d: WebhookDelivery)}<TableCell><span class="t-body-m-strong wrap-anywhere" title={d.event_type}>{eventTitle(d.event_type)}</span></TableCell>{/snippet}
{#snippet statusCell(d: WebhookDelivery)}
	<TableCell>
		<span class="flex flex-col gap-0.5">
			<StatusChip label={labelOf(OUTBOX_STATUSES, d.status)} tone={tone(d.status)} hint={outboxHint(d.status)} />
			{#if d.next_retry_at && d.status !== 'sent'}<span class="t-desc-m text-soft">повтор <DateText value={d.next_retry_at} time /></span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet attemptsCell(d: WebhookDelivery)}<TableCell align="right"><span class="t-body-s tabular-nums">{d.attempts}</span></TableCell>{/snippet}
{#snippet whenCell(d: WebhookDelivery)}<TableCell><span class="t-body-s"><DateText value={d.created_at} time /></span></TableCell>{/snippet}
{#snippet errorCell(d: WebhookDelivery)}<TableCell>{#if d.last_error}<span class="t-desc-l line-clamp-2 text-danger" title={d.last_error}>{deliveryErrorText(d.last_error)}</span>{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}
{#snippet retryBtn(d: WebhookDelivery)}
	{#if retryable(d)}<IconBtn icon={Send} label="Повторить доставку" disabled={busy !== null} onclick={() => retry(d)} />{/if}
{/snippet}
{#snippet actionCell(d: WebhookDelivery)}<TableCell align="right">{@render retryBtn(d)}</TableCell>{/snippet}
{#snippet card(d: WebhookDelivery)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2"><span class="t-body-m-strong wrap-anywhere">{eventTitle(d.event_type)}</span><StatusChip label={labelOf(OUTBOX_STATUSES, d.status)} tone={tone(d.status)} hint={outboxHint(d.status)} /></div>
		<span class="t-desc-l text-muted"><DateText value={d.created_at} time /> · попыток: {d.attempts}</span>
		{#if d.last_error}<span class="t-desc-l line-clamp-3 text-danger wrap-anywhere" title={d.last_error}>{deliveryErrorText(d.last_error)}</span>{/if}
		{#if retryable(d)}<div class="flex justify-end">{@render retryBtn(d)}</div>{/if}
	</div>
{/snippet}

<AppDrawer open={subscription !== null} title={subscription ? `Доставки: ${subscription.name}` : 'Доставки'} width={760} {onClose}>
	<div class="flex min-w-0 flex-col gap-3">
		<div class="flex items-end gap-2">
			<div class="min-w-0 flex-1 max-w-[280px] max-md:max-w-none"><Pick label="Статус" clearable placeholder="Любой" value={status} items={OUTBOX_STATUSES.map((s) => ({ key: s.key, value: s.value }))} onChange={(v) => (status = v)} /></div>
			<IconBtn icon={Refresh} label="Обновить" onclick={() => list.reload()} />
		</div>
		<DataTable rows={list.items} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} hasMore={list.hasMore} loadingMore={list.loadingMore} onLoadMore={() => list.loadMore()} emptyText={status ? 'Ничего не найдено' : 'Доставок пока не было'} ariaLabel="Доставки подписки" embedded />
	</div>
</AppDrawer>
