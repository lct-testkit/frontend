<script lang="ts">
	// Статус сделки: название и цвет берутся из графа воронки (грузится общим кэшем).
	import { StatusChip } from '$lib/ui';
	import { workflows } from './workflows.svelte';
	import { statusName, statusTone } from './statusUtils';
	import { statusTypeHint } from '../shared/hints';

	let { statusId }: { statusId: string } = $props();

	const status = $derived(workflows.status(statusId));
</script>

{#if status}
	<StatusChip label={statusName(status.name)} color={status.color} tone={statusTone(status.type)} hint={statusTypeHint(status.type)} />
{:else}
	<!-- серая плашка высоты настоящей (24 px), пока граф воронки не пришёл: иначе строка карточки подрастает на 3 px и всё ниже сдвигается -->
	<span class="inline-flex h-6 w-24 animate-pulse rounded-full bg-surface-3" role="img" aria-label="Статус загружается"></span>
{/if}
