<script lang="ts">
	// Пометки к готовому отчёту (усечение по пределу строк, данные из снимка): по одной плашке на пометку.
	import { Notice } from '$lib/ui';
	import type { ReportNote } from './notes';

	let { notes, class: className = '' }: { notes: readonly ReportNote[]; class?: string } = $props();
</script>

{#each notes as note (note.kind)}
	<Notice tone={note.tone} class={className}>{note.text}</Notice>
{/each}
