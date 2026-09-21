<script lang="ts">
	// Одно состояние блока в каталоге: подпись + сам блок. `bare` — без пунктирной рамки (блоки, которые сами занимают всю ширину).
	import type { Snippet } from 'svelte';

	let { title, children, bare = false }: { title: string; children?: Snippet; bare?: boolean } = $props();
</script>

<section class="flex min-w-0 flex-col gap-2">
	<p class="t-desc-l text-muted">{title}</p>
	<div class={['min-w-0', !bare && 'rounded-lg border border-dashed border-line-strong p-4 max-md:p-3']}>{@render children?.()}</div>
</section>
