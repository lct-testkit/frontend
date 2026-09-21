<script lang="ts">
	// Срок SLA: пилюля StatusChip с цветной точкой «осталось 2 д 3 ч» / «просрочено на 5 ч» / «на паузе». Состояние считается на клиенте (воркер бэкенда — раз в 15 мин).
	import { StatusChip } from '$lib/ui';
	import { formatDateTime } from '$lib/utils/format';
	import { slaColorScheme, slaLabel, slaProgress, type SlaSource } from '../deals/sla';
	import { nowMs } from './clock.svelte';

	let { deal, compact = false }: { deal: SlaSource; compact?: boolean } = $props();

	const progress = $derived(slaProgress(deal, nowMs()));
	// в узкой колонке (`compact`) текст короче, полный — в подсказке
	const title = $derived(progress.dueAt ? `${compact ? `${slaLabel(progress)}. ` : ''}Срок: ${formatDateTime(progress.dueAt)}` : undefined);
</script>

{#if progress.state === 'none'}
	<span class="text-soft">—</span>
{:else}
	<StatusChip label={slaLabel(progress, compact)} tone={slaColorScheme(progress.state)} {title} />
{/if}
