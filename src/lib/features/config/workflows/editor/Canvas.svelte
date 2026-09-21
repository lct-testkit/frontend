<script lang="ts">
	// Обёртка холста: провайдер xyflow нужен, чтобы `useSvelteFlow()` работал в дочернем компоненте.
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import type { ComponentProps } from 'svelte';
	import CanvasFlow from './CanvasFlow.svelte';

	let props: ComponentProps<typeof CanvasFlow> = $props();
</script>

<SvelteFlowProvider>
	<CanvasFlow {...props} />
</SvelteFlowProvider>
