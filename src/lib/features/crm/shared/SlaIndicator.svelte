<script lang="ts">
	// Срок SLA: пилюля StatusChip с цветной точкой «Осталось 2 д 3 ч» / «Просрочено на 5 ч». Пауза (сделка заморожена) отдельно не показывается: её уже говорит статус «Заморожена». Состояние считается на клиенте (воркер бэкенда — раз в 15 мин).
	import { StatusChip, Tip } from '$lib/ui';
	import { formatDateTime } from '$lib/utils/format';
	import { slaColorScheme, slaLabel, slaProgress, type SlaSource } from '../deals/sla';
	import { nowMs } from './clock.svelte';
	import { SLA_STATE_HINTS, slaHint } from './hints';

	let { deal, compact = false }: { deal: SlaSource; compact?: boolean } = $props();

	const progress = $derived(slaProgress(deal, nowMs()));
	// подсказка над плашкой: что значит состояние + точный срок; в узкой колонке (`compact`) текст короче, полный — в подсказке
	const hint = $derived(slaHint(progress.state, progress.dueAt ? formatDateTime(progress.dueAt) : null, compact ? slaLabel(progress) : null));
</script>

{#if progress.state === 'none'}
	<span class="text-soft">—</span>
{:else if progress.state === 'paused'}
	<Tip title="Срок остановлен" text={SLA_STATE_HINTS.paused}><span class="text-soft">—</span></Tip>
{:else}
	<StatusChip label={slaLabel(progress, compact)} tone={slaColorScheme(progress.state)} {hint} />
{/if}
