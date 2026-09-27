<script lang="ts">
	import { StatusChip } from '$lib/ui';
	import { PRIORITY_LABELS, PRIORITY_SCHEMES } from './labels';
	import { priorityHint } from './hints';

	// `hideNormal` — без «обычного»; `onlyUrgent` — только «высокий» и «критичный» (списки задач: низкий приоритет — шум)
	let { priority, hideNormal = false, onlyUrgent = false }: { priority: string; hideNormal?: boolean; onlyUrgent?: boolean } = $props();
</script>

{#if !(hideNormal && priority === 'normal') && !(onlyUrgent && priority !== 'high' && priority !== 'critical')}
	<StatusChip label={PRIORITY_LABELS[priority] ?? priority} tone={PRIORITY_SCHEMES[priority] ?? 'neutral'} hint={priorityHint(priority)} />
{/if}
