<script lang="ts">
	// Вкладка «Обзор»: поля сделки, пользовательские поля воронки, продукты (только чтение — backend-issues A-7) и участники.
	import { onMount } from 'svelte';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, Money } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import { formatDate, formatNumber } from '$lib/utils/format';
	import Field from '../../shared/Field.svelte';
	import PriorityChip from '../../shared/PriorityChip.svelte';
	import { DEAL_SOURCE_LABELS, DEAL_TYPE_LABELS, label } from '../../shared/labels';
	import { dealFieldDefs, lossReasons, products } from '../../shared/refs.svelte';
	import type { CustomFieldDef } from '../../types';
	import type { DealCardState } from './dealCard.svelte';
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
			<dl class="m-0 grid grid-cols-3 gap-x-6 gap-y-4 max-xl:grid-cols-2 max-md:grid-cols-1">
				<Field label="Тип">{label(DEAL_TYPE_LABELS, deal.deal_type)}</Field>
				<Field label="Воронка">{card.graph?.workflow.name ?? '—'}</Field>
				<Field label="Приоритет"><PriorityChip priority={deal.priority} /></Field>
				<Field label="Сумма"><Money value={deal.amount} currency={deal.currency} /></Field>
				<Field label="Обучающихся">{deal.students_planned ?? '—'}</Field>
				<Field label="Плановая дата закрытия">{deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}</Field>
				<Field label="Источник">{deal.source ? label(DEAL_SOURCE_LABELS, deal.source) : '—'}</Field>
				<Field label="Создана"><DateText value={deal.created_at} time /></Field>
				<Field label="Изменена"><DateText value={deal.updated_at} time /></Field>
				{#if deal.closed_at}<Field label="Закрыта"><DateText value={deal.closed_at} time /></Field>{/if}
				{#if lossReason}<Field label="Причина отказа">{lossReason}</Field>{/if}
				{#each defs as def (def.id)}
					<Field label={def.label}>{customText(def, deal.custom_fields[def.code])}</Field>
				{/each}
			</dl>
		</Card>

		<Card title="Продукты" flush>
			{#if card.products.length === 0}
				<p class="t-body-m m-0 px-4 py-3 text-muted">Продукты не добавлены</p>
			{:else}
				<div class="t-desc-l grid grid-cols-[minmax(0,1fr)_4rem_7rem_4rem_7rem] gap-x-3 border-b border-line px-4 py-2 text-muted max-md:hidden">
					<span>Продукт</span><span class="text-right">Кол-во</span><span class="text-right">Цена</span><span class="text-right">Скидка</span><span class="text-right">Итого</span>
				</div>
				<ul class="m-0 list-none p-0">
					{#each card.products as p (p.id)}
						<li class="t-body-m grid grid-cols-[minmax(0,1fr)_4rem_7rem_4rem_7rem] items-center gap-x-3 border-b border-line px-4 py-2.5 last:border-b-0 max-md:grid-cols-2 max-md:gap-y-1">
							<span class="min-w-0 break-words max-md:col-span-2">{productName(p.product_id)}</span>
							<span class="text-right max-md:text-left"><span class="text-muted md:hidden">Кол-во: </span>{p.quantity}</span>
							<span class="text-right"><Money value={p.price} currency={deal.currency} /></span>
							<span class="text-right">{Number(p.discount_pct) ? `${formatNumber(p.discount_pct)}%` : '—'}</span>
							<span class="t-body-m-strong text-right max-md:col-span-2 max-md:text-left"><Money value={lineTotal(p)} currency={deal.currency} /></span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>

	<Card title="Участники">
		<div class="flex flex-col gap-2"><DealParticipants dealId={deal.id} canEdit={session.can('deal:update') && !card.closed} /></div>
	</Card>
</div>
