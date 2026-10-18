<script lang="ts">
	// Узел холста — статус воронки: цветная полоса, название, тип, срок SLA, значок проблем. Архивный — полупрозрачный с замком.
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { Attention, AttentionMark, Lock, Stopwatch } from '@lct-testkit/rt-ui/icons';
	import { STATUS_TYPE_LABELS, type StatusNode } from '../graph';
	import { statusColor } from '../palette';
	import { formatHours } from './format';

	let { data, selected }: NodeProps<StatusNode> = $props();

	const status = $derived(data.status);
	const errors = $derived(data.issues.filter((i) => i.severity === 'error').length);
	const warnings = $derived(data.issues.length - errors);
	const SIDES = [
		{ id: 'l', position: Position.Left },
		{ id: 'r', position: Position.Right },
		{ id: 't', position: Position.Top },
		{ id: 'b', position: Position.Bottom }
	];
	const HANDLE = 'size-3! border-2! border-surface! bg-soft! hover:bg-accent!';
</script>

<div
	class={[
		'relative w-58 overflow-hidden rounded-md border bg-surface shadow-s',
		selected ? 'border-accent ring-2 ring-accent-soft' : errors ? 'border-danger' : 'border-line',
		status.is_archived && 'opacity-55'
	]}
>
	<span class="absolute inset-y-0 left-0 w-1.5" style:background={statusColor(status)}></span>
	<div class="flex flex-col gap-1 py-2 pr-4 pl-4">
		<div class="flex items-start gap-1.5">
			<span class="t-body-m-strong line-clamp-3 min-w-0 flex-1 wrap-anywhere" title={status.name}>{status.name || 'Без названия'}</span>
			{#if status.is_archived}
				<Lock class="size-4 flex-none fill-soft" />
			{:else if errors}
				<AttentionMark class="size-4 flex-none fill-danger" />
			{:else if warnings}
				<Attention class="size-4 flex-none fill-warning" />
			{/if}
		</div>
		<div class="t-desc-l flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted">
			<!-- у обычного шага тип («Промежуточный») не пишем: он ничего не говорит, а строка нужна под срок и значки -->
			{#if status.is_archived || status.type !== 'intermediate'}<span>{status.is_archived ? 'В архиве' : STATUS_TYPE_LABELS[status.type]}</span>{/if}
			{#if data.sla && data.sla.is_active}
				<span class="inline-flex items-center gap-0.5"><Stopwatch class="size-4 fill-soft" />{formatHours(data.sla.max_duration_hours)}</span>
			{/if}
			<!-- переходы в отказ и заморозку по умолчанию скрыты — значки напоминают, что они есть; клик по узлу показывает их рёбра -->
			{#if data.exits.lost}<span class="text-danger" title="Есть переход в отказ">Отказ</span>{/if}
			{#if data.exits.parked}<span class="text-warning" title="Есть переход в заморозку">Заморозка</span>{/if}
			{#if data.entries > 0}<span title="Переходов в этот статус">Входов: {data.entries}</span>{/if}
		</div>
	</div>
	<!-- по четыре точки на узле (слева, справа, сверху, снизу): ребро выходит с той стороны, что ближе к цели, — в раскладке «змейкой» ряды идут навстречу друг другу -->
	{#each SIDES as side (side.id)}
		<Handle type="source" id="s-{side.id}" position={side.position} class={HANDLE} isConnectable={!data.readonly && !status.is_archived} />
		<Handle type="target" id="t-{side.id}" position={side.position} class={HANDLE} isConnectable={!data.readonly && !status.is_archived} />
	{/each}
</div>
