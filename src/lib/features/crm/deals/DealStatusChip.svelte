<script lang="ts">
	// Статус сделки: название и цвет берутся из графа воронки (грузится общим кэшем).
	import { StatusChip } from '$lib/ui';
	import { workflows } from './workflows.svelte';
	import { statusTone } from './statusUtils';

	let { statusId }: { statusId: string } = $props();

	const status = $derived(workflows.status(statusId));
</script>

{#if status}
	<StatusChip label={status.name} color={status.color} tone={statusTone(status.type)} />
{:else}
	<span class="text-soft">…</span>
{/if}
