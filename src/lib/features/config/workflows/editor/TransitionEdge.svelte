<script lang="ts">
	// Ребро холста — переход: подпись с названием и значками (роли, комментарий, условия, действия). Проблемное — красное, выбранное — акцентное.
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import { AttentionMark, ChatNew, Filter, Lock, Magic } from '@lct-testkit/rt-ui/icons';
	import type { TransitionEdge } from '../graph';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, selected }: EdgeProps<TransitionEdge> = $props();

	let [path, labelX, labelY] = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));

	let hovered = $state(false);
	const hasError = $derived((data?.issues ?? []).some((i) => i.severity === 'error'));
	const stroke = $derived(selected ? 'var(--atmr-accent-default)' : hasError ? 'var(--atmr-error-default)' : 'var(--atmr-fg-soft)');
	const ICON = 'size-3.5 flex-none fill-soft';
</script>

<BaseEdge
	{id}
	{path}
	{markerEnd}
	interactionWidth={28}
	style="stroke: {stroke}; stroke-width: {selected || hovered ? 2.5 : 1.5}; {data?.hasConditions ? 'stroke-dasharray: 6 4;' : ''}"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
/>
{#if !data?.compact || selected || hovered || hasError}
<EdgeLabel x={labelX} y={labelY} selectEdgeOnClick class="p-0! bg-transparent!" onclick={() => data?.select?.()}>
	<span
		class={[
			't-desc-s flex max-w-44 items-center gap-1 rounded-full border bg-surface px-2 py-0.5 shadow-s',
			selected ? 'border-accent text-accent' : hasError ? 'border-danger text-danger' : 'border-line text-muted'
		]}
	>
		<span class="truncate">{data?.transition.name || 'Переход'}</span>
		{#if hasError}<AttentionMark class="size-3.5 flex-none fill-danger" />{/if}
		{#if data?.restricted}<Lock class={ICON} />{/if}
		{#if data?.requiresComment}<ChatNew class={ICON} />{/if}
		{#if data?.hasConditions}<Filter class={ICON} />{/if}
		{#if data?.hasActions}<Magic class={ICON} />{/if}
	</span>
</EdgeLabel>
{/if}
