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
	const HANDLE = 'size-3! border-2! border-surface! bg-soft! hover:bg-accent!';
</script>

<div
	class={[
		'relative w-60 overflow-hidden rounded-md border bg-surface shadow-s',
		selected ? 'border-accent ring-2 ring-accent-soft' : errors ? 'border-danger' : 'border-line',
		status.is_archived && 'opacity-55'
	]}
>
	<span class="absolute inset-y-0 left-0 w-1.5" style:background={statusColor(status)}></span>
	<div class="flex flex-col gap-1 py-2 pr-3 pl-4">
		<div class="flex items-start gap-1.5">
			<span class="t-body-s-strong min-w-0 flex-1 wrap-anywhere">{status.name || 'Без названия'}</span>
			{#if status.is_archived}
				<Lock class="size-4 flex-none fill-soft" />
			{:else if errors}
				<AttentionMark class="size-4 flex-none fill-danger" />
			{:else if warnings}
				<Attention class="size-4 flex-none fill-warning" />
			{/if}
		</div>
		<div class="t-desc-s flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted">
			<span>{status.is_archived ? 'В архиве' : STATUS_TYPE_LABELS[status.type]}</span>
			{#if data.sla && data.sla.is_active}
				<span class="inline-flex items-center gap-0.5"><Stopwatch class="size-3.5 fill-soft" />{formatHours(data.sla.max_duration_hours)}</span>
			{/if}
		</div>
	</div>
	<Handle type="target" position={Position.Left} class={HANDLE} isConnectable={!data.readonly && !status.is_archived} />
	<Handle type="source" position={Position.Right} class={HANDLE} isConnectable={!data.readonly && !status.is_archived} />
</div>
