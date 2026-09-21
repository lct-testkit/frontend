<script lang="ts">
	// Рамка одного блока для каталога (и для скриншотов): /dev/blocks/frame?demo=<id>&theme=<тема>
	// Без оболочки приложения и без сессии — блоки показываются на моковых данных, как на странице приложения (фон, отступы).
	import { onMount, type Component } from 'svelte';
	import { page } from '$app/state';

	const loaders: Record<string, () => Promise<{ default: Component }>> = import.meta.env.DEV ? import.meta.glob<{ default: Component }>('../demos/*.demo.svelte') : {};

	const id = $derived(page.url.searchParams.get('demo') ?? '');
	const loader = $derived(Object.entries(loaders).find(([path]) => path.endsWith(`/${id}.demo.svelte`))?.[1]);

	let Demo = $state<Component | null>(null);
	$effect(() => {
		const load = loader;
		Demo = null;
		void load?.().then((m) => (Demo = m.default));
	});

	// высота — у содержимого (не у окна), иначе рамка только росла бы
	let box = $state<HTMLElement | null>(null);
	onMount(() => {
		if (!box) return;
		const report = () => parent.postMessage({ type: 'rtk-frame-height', height: box!.offsetHeight }, location.origin);
		const observer = new ResizeObserver(report);
		observer.observe(box);
		report();
		return () => observer.disconnect();
	});
</script>

<div bind:this={box} class="flex flex-col gap-8 p-6 max-lg:p-4 max-md:p-3">
	{#if Demo}<Demo />{:else if !loader}<p class="t-body-m text-danger">Нет блока «{id}»</p>{/if}
</div>
