<script lang="ts">
	// Подписки на исходящие события: список (таблица, на телефоне карточки), переключатель «Активна», панель правки, журнал доставок. Создание — кнопка страницы (`create()`).
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { DataTable, EmptyState, StatusChip, TableCell, Tip, type Col } from '$lib/ui';
	import { createResource } from '../shared/resource.svelte';
	import SwitchCell from '../shared/SwitchCell.svelte';
	import type { WebhookSubscription } from '../types';
	import DeliveriesDrawer from './DeliveriesDrawer.svelte';
	import SecretModal from './SecretModal.svelte';
	import SubscriptionDrawer from './SubscriptionDrawer.svelte';
	import { disabledReasonText, eventTitle, urlLabel } from './subscriptions';

	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/webhooks', { signal })).then((r) => r as WebhookSubscription[]));
	onMount(() => void list.reload());

	let open = $state(false);
	let editing = $state<WebhookSubscription | null>(null);
	let journal = $state<WebhookSubscription | null>(null);
	let secret = $state<{ value: string; title: string } | null>(null);

	export function create() {
		editing = null;
		open = true;
	}
	const edit = (s: WebhookSubscription) => {
		editing = s;
		open = true;
	};
	const replace = (saved: WebhookSubscription) => list.set((list.data ?? []).map((s) => (s.id === saved.id ? saved : s)));

	async function toggle(s: WebhookSubscription, next: boolean) {
		replace(await unwrap(api.PATCH('/api/admin/integrations/webhooks/{subscription_id}', { params: { path: { subscription_id: s.id } }, body: { is_active: next } })));
	}

	const columns: Col<WebhookSubscription>[] = [
		{ key: 'name', title: 'Название', width: 'minmax(160px, 1.2fr)', render: nameCell },
		{ key: 'url', title: 'Адрес', width: 'minmax(180px, 1.4fr)', drop: 2, render: urlCell },
		{ key: 'events', title: 'События', width: 'minmax(180px, 1.4fr)', drop: 1, render: eventsCell },
		{ key: 'fails', title: 'Неудач подряд', align: 'right', drop: 3, render: failsCell },
		{ key: 'active', title: 'Активна', render: activeCell }
	];
</script>

{#snippet eventChips(s: WebhookSubscription)}
	<span class="flex min-w-0 flex-wrap items-center gap-1">
		{#each s.event_types.slice(0, 3) as e (e)}<StatusChip label={eventTitle(e)} />{/each}
		{#if s.event_types.length > 3}<span class="t-desc-l text-muted" title={s.event_types.slice(3).map(eventTitle).join(', ')}>ещё {s.event_types.length - 3}</span>{/if}
	</span>
{/snippet}
{#snippet nameCell(s: WebhookSubscription)}<TableCell><span class="t-body-m-strong wrap-anywhere">{s.name}</span></TableCell>{/snippet}
{#snippet urlCell(s: WebhookSubscription)}<TableCell><span class="t-body-s wrap-anywhere text-muted" title={s.url}>{urlLabel(s.url)}</span></TableCell>{/snippet}
{#snippet eventsCell(s: WebhookSubscription)}<TableCell>{@render eventChips(s)}</TableCell>{/snippet}
{#snippet failsCell(s: WebhookSubscription)}<TableCell align="right"><span class={['t-body-s tabular-nums', s.consecutive_failures > 0 && 'text-danger']}>{s.consecutive_failures}</span></TableCell>{/snippet}
{#snippet activeCell(s: WebhookSubscription)}
	<TableCell>
		<span class="flex items-center gap-2">
			<SwitchCell checked={s.is_active} label={s.is_active ? `Выключить «${s.name}»` : `Включить «${s.name}»`} onToggle={(next) => toggle(s, next)} />
			{#if s.disabled_reason}<Tip text={disabledReasonText(s.disabled_reason) ?? ''} placement="top"><StatusChip label="Выключена" tone="warning" /></Tip>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet card(s: WebhookSubscription)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-3">
			<span class="t-body-m-strong min-w-0 wrap-anywhere">{s.name}</span>
			<SwitchCell checked={s.is_active} label={s.is_active ? `Выключить «${s.name}»` : `Включить «${s.name}»`} onToggle={(next) => toggle(s, next)} />
		</div>
		<span class="t-desc-l wrap-anywhere text-muted" title={s.url}>{urlLabel(s.url)}</span>
		{@render eventChips(s)}
		{#if s.disabled_reason}<span class="t-desc-l text-warning">{disabledReasonText(s.disabled_reason)}</span>{/if}
		{#if s.consecutive_failures > 0}<span class="t-desc-l text-danger">Неудач подряд: {s.consecutive_failures}</span>{/if}
	</div>
{/snippet}

<DataTable rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} onRowClick={edit} ariaLabel="Подписки на исходящие события">
	{#snippet empty()}<EmptyState title="Подписок нет" hint="Создайте первую, чтобы отдавать события во внешнюю систему" />{/snippet}
</DataTable>

<SubscriptionDrawer
	{open}
	subscription={editing}
	onClose={() => (open = false)}
	onSaved={replace}
	onCreated={(created, value) => {
		list.set([created, ...(list.data ?? [])]);
		secret = { value, title: 'Секрет подписи' };
	}}
	onRotated={(saved, value) => {
		replace(saved);
		secret = { value, title: 'Новый секрет подписи' };
	}}
	onDeleted={(id) => list.set((list.data ?? []).filter((s) => s.id !== id))}
	onDeliveries={(s) => (journal = s)}
/>
<DeliveriesDrawer subscription={journal} onClose={() => (journal = null)} />
<SecretModal value={secret?.value ?? null} title={secret?.title ?? ''} label="Секрет" note="Передайте его принимающей системе: им она проверяет подпись." onClose={() => (secret = null)} />
