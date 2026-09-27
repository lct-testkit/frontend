<script lang="ts">
	// Вкладка «Обзор»: поля по смыслу — «Сделка» (что это), «Стоимость и сроки», «Заморозка» / «Отказ» (только в таком статусе), дополнительные поля воронки, продукты (только чтение — backend-issues A-7), участники.
	// Приоритет (внутренняя оценка CRM) — чипом в шапке, «Изменена» (служебная дата) — тихой строкой внизу; в фактах сделки их нет.
	import { onMount } from 'svelte';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, KeyValue, KeyValueList, Money } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import { formatDate, formatNumber } from '$lib/utils/format';
	import { DEAL_SOURCE_LABELS, DEAL_TYPE_LABELS, label } from '../../shared/labels';
	import { dealFieldDefs, lossReasons, products } from '../../shared/refs.svelte';
	import type { CustomFieldDef } from '../../types';
	import type { DealCardState } from './dealCard.svelte';
	import { isStatusField, statusGroup, STATUS_GROUP_TITLES } from './dealSections';
	import DealParticipants from './DealParticipants.svelte';

	let { card }: { card: DealCardState } = $props();

	const deal = $derived(card.deal!);

	onMount(() => {
		void dealFieldDefs.ensure().catch(() => {});
		void lossReasons.ensure().catch(() => {});
		void products.ensure().catch(() => {});
	});

	// пустые пользовательские поля в обзоре не показываем (их можно заполнить в «Редактировать»)
	const defs = $derived(
		(dealFieldDefs.value ?? [])
			.filter((d) => !d.workflow_id || d.workflow_id === deal.workflow_id)
			.filter((d) => {
				const v = deal.custom_fields[d.code];
				return v !== null && v !== undefined && v !== '';
			})
			.sort((a, b) => a.sort_order - b.sort_order)
	);
	const group = $derived(statusGroup(card.status?.type));
	const statusDefs = $derived(defs.filter((d) => isStatusField(d.code, group, card.status?.required_fields)));
	const extraDefs = $derived(defs.filter((d) => !statusDefs.includes(d)));
	const lossReason = $derived(deal.loss_reason_id ? (lossReasons.value?.find((r) => r.id === deal.loss_reason_id)?.name ?? '—') : null);
	const productName = (id: string) => products.value?.find((p) => p.id === id)?.name ?? '…';
	/** итог строки: с бэкенда может прийти null (создано без `total`) — считаем сами: цена × количество − скидка */
	const lineTotal = (p: { quantity: number; price?: string | null; discount_pct: string; total?: string | null }): string | null => {
		if (p.total !== null && p.total !== undefined) return p.total;
		if (p.price === null || p.price === undefined) return null;
		return String(Number(p.price) * p.quantity * (1 - Number(p.discount_pct || 0) / 100));
	};

	function customText(def: CustomFieldDef, value: unknown): string {
		if (value === null || value === undefined || value === '') return '—';
		if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
		if (def.field_type === 'date' && typeof value === 'string') return formatDate(value);
		if (def.field_type === 'number' && (typeof value === 'number' || typeof value === 'string')) return formatNumber(value);
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}
</script>

<div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-4 max-lg:grid-cols-1">
	<div class="flex min-w-0 flex-col gap-4">
		<Card title="Сделка">
			<KeyValueList columns={3}>
				<KeyValue label="Тип" value={label(DEAL_TYPE_LABELS, deal.deal_type)} />
				<KeyValue label="Воронка" value={card.graph?.workflow.name} />
				<KeyValue label="Источник" value={deal.source ? label(DEAL_SOURCE_LABELS, deal.source) : null} />
				<KeyValue label="Обучающихся" value={deal.students_planned} />
				{#if deal.order_number}<KeyValue label="Номер заявки"><span class="font-mono wrap-anywhere">{deal.order_number}</span></KeyValue>{/if}
			</KeyValueList>
		</Card>

		<Card title="Стоимость и сроки">
			<KeyValueList columns={3}>
				<KeyValue label="Сумма"><Money value={deal.amount} currency={deal.currency} /></KeyValue>
				<KeyValue label="Плановая дата закрытия" value={deal.expected_close_date ? formatDate(deal.expected_close_date) : null} />
				<KeyValue label="Создана"><DateText value={deal.created_at} time /></KeyValue>
				{#if deal.closed_at && !group}<KeyValue label="Закрыта"><DateText value={deal.closed_at} time /></KeyValue>{/if}
			</KeyValueList>
		</Card>

		{#if group}
			<Card title={STATUS_GROUP_TITLES[group]}>
				<KeyValueList columns={3}>
					{#if deal.closed_at}<KeyValue label={group === 'frozen' ? 'Заморожена' : 'Отказ оформлен'}><DateText value={deal.closed_at} time /></KeyValue>{/if}
					{#if group === 'lost'}<KeyValue label="Причина отказа" value={lossReason} />{/if}
					{#each statusDefs as def (def.id)}
						<KeyValue label={def.label} value={customText(def, deal.custom_fields[def.code])} />
					{/each}
				</KeyValueList>
			</Card>
		{/if}

		{#if extraDefs.length}
			<Card title="Дополнительные поля">
				<KeyValueList columns={3}>
					{#each extraDefs as def (def.id)}
						<KeyValue label={def.label} value={customText(def, deal.custom_fields[def.code])} />
					{/each}
				</KeyValueList>
			</Card>
		{/if}

		<Card title="Продукты" flush>
			{#if card.products.length === 0}
				<p class="t-body-m m-0 px-4 py-3 text-muted">Продукты не добавлены</p>
			{:else}
				<div class="t-desc-l grid grid-cols-[minmax(0,1fr)_4rem_7rem_4rem_7rem] gap-x-3 border-b border-line px-4 py-2 text-muted max-md:hidden">
					<span>Продукт</span><span class="text-right">Кол-во</span><span class="text-right">Цена</span><span class="text-right">Скидка</span><span class="text-right">Итого</span>
				</div>
				<ul class="m-0 list-none p-0">
					{#each card.products as p (p.id)}
						<!-- a phone: the name on its own line, then the small facts in a row with their words, the total last -->
						<li class="t-body-m flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0 md:grid md:grid-cols-[minmax(0,1fr)_4rem_7rem_4rem_7rem] md:items-center md:gap-x-3">
							<span class="min-w-0 basis-full break-words md:basis-auto">{productName(p.product_id)}{#if p.stream_number}<span class="t-desc-l text-muted"> · поток {p.stream_number}</span>{/if}</span>
							<span class="text-left md:text-right"><span class="mr-1 text-muted md:hidden">Кол-во:</span>{p.quantity}</span>
							<span class="text-left md:text-right"><span class="mr-1 text-muted md:hidden">Цена:</span><Money value={p.price} currency={deal.currency} /></span>
							<span class={['text-left md:text-right', !Number(p.discount_pct) && 'max-md:hidden']}><span class="mr-1 text-muted md:hidden">Скидка:</span>{Number(p.discount_pct) ? `${formatNumber(p.discount_pct)}%` : '—'}</span>
							<span class="t-body-m-strong basis-full text-left md:basis-auto md:text-right"><span class="mr-1 font-normal text-muted md:hidden">Итого:</span><Money value={lineTotal(p)} currency={deal.currency} /></span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<p class="t-desc-l m-0 text-muted">Изменена <DateText value={deal.updated_at} time /></p>
	</div>

	<Card title="Участники">
		<div class="flex flex-col gap-2"><DealParticipants dealId={deal.id} canEdit={session.can('deal:update') && !card.closed && card.writable} /></div>
	</Card>
</div>
