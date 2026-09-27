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
	<span class="text-soft">…</span>
{/if}
