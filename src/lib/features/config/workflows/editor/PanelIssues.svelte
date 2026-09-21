<script lang="ts">
	// Замечания к выбранному статусу или переходу внутри его панели: ошибки — красным, советы — жёлтым.
	import { Notice } from '$lib/ui';
	import type { GraphIssue } from '../graph';

	let { issues }: { issues: readonly GraphIssue[] } = $props();
</script>

{#if issues.length}
	<div class="flex flex-col gap-1.5">
		{#each issues as i, n (n)}
			<Notice class="shrink-0" tone={i.severity === 'error' ? 'error' : 'warning'}>{i.message}</Notice>
		{/each}
	</div>
{/if}
