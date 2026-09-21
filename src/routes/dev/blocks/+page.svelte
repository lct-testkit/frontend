<script lang="ts">
	// Каталог блоков интерфейса (только для разработки): каждый блок в своих состояниях, в живом окне нужной ширины и темы.
	// Один блок = один файл demos/<id>.demo.svelte; здесь он открывается в <iframe>, поэтому медиазапросы и useBreakpoint()
	// работают по ширине окна-рамки, а не всей страницы. Готовый блок подключается на экраны только после приёмки.
	import { onMount } from 'svelte';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';

	interface DemoMeta {
		block: string;
		title: string;
		/** эталон в rt-ui и правила блока — одной-двумя строками */
		note?: string;
	}

	// `import.meta.env.DEV` is false in a production build: the demos are then not even in the bundle (the route itself answers 404, see ../+layout.ts)
	const metas: Record<string, DemoMeta> = import.meta.env.DEV ? import.meta.glob<DemoMeta>('./demos/*.demo.svelte', { eager: true, import: 'meta' }) : {};
	const demos = Object.entries(metas)
		.map(([path, meta]) => ({ id: path.replace('./demos/', '').replace('.demo.svelte', ''), ...meta }))
		.sort((a, b) => a.id.localeCompare(b.id));

	const WIDTHS = ['auto', '1440', '1024', '768', '390', '360'] as const;
	const THEME_OPTIONS = [
		{ key: 'light', label: 'Светлая' },
		{ key: 'dark', label: 'Тёмная' },
		{ key: 'both', label: 'Обе' }
	];

	let width = $state<(typeof WIDTHS)[number]>('auto');
	let themeMode = $state('light');
	let only = $state('');

	const themes = $derived(themeMode === 'both' ? ['rtk_default_light', 'rtk_default_dark'] : [themeMode === 'dark' ? 'rtk_default_dark' : 'rtk_default_light']);
	const shown = $derived(only ? demos.filter((d) => d.id === only) : demos);

	// каждая рамка сообщает свою высоту — <iframe> подстраивается под содержимое
	let heights = $state<Record<string, number>>({});
	let frames: Record<string, HTMLIFrameElement | null> = {};
	onMount(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== location.origin || event.data?.type !== 'rtk-frame-height') return;
			const key = Object.keys(frames).find((k) => frames[k]?.contentWindow === event.source);
			if (key) heights[key] = Math.ceil(event.data.height);
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});
</script>

<svelte:head><title>Блоки · каталог</title></svelte:head>

<div class="min-h-dvh bg-page text-fg">
	<header class="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-6 py-3">
		<h1 class="t-h4">Блоки интерфейса</h1>
		<SegmentedControl size="s" value={themeMode} onChange={(v: string) => (themeMode = v)}>
			{#each THEME_OPTIONS as option (option.key)}<Segment index={option.key} label={option.label} />{/each}
		</SegmentedControl>
		<SegmentedControl size="s" value={width} onChange={(v: string) => (width = v as typeof width)}>
			{#each WIDTHS as w (w)}<Segment index={w} label={w === 'auto' ? 'Авто' : w} />{/each}
		</SegmentedControl>
		<nav class="flex flex-wrap gap-x-3 gap-y-1" aria-label="Блоки">
			<button type="button" class={['t-body-s', only === '' ? 'text-fg underline' : 'text-muted']} onclick={() => (only = '')}>Все</button>
			{#each demos as demo (demo.id)}
				<button type="button" class={['t-body-s', only === demo.id ? 'text-fg underline' : 'text-muted']} onclick={() => (only = demo.id)}>{demo.block}</button>
			{/each}
		</nav>
	</header>

	<main class="mx-auto flex max-w-[1600px] flex-col gap-10 p-6 max-md:p-3">
		{#each shown as demo (demo.id)}
			<section class="flex flex-col gap-3" id={demo.id}>
				<div>
					<h2 class="t-h3">{demo.block} · {demo.title}</h2>
					{#if demo.note}<p class="t-body-s mt-1 max-w-4xl text-muted">{demo.note}</p>{/if}
				</div>
				{#each themes as theme (theme)}
					{@const key = `${demo.id}:${theme}`}
					<div class="overflow-x-auto">
						<iframe
							bind:this={frames[key]}
							title="{demo.title} — {theme}"
							src="/dev/blocks/frame?demo={demo.id}&theme={theme}"
							loading="lazy"
							class="block max-w-full rounded-lg border border-line-strong bg-page"
							style:width={width === 'auto' ? '100%' : `${width}px`}
							style:height="{heights[key] ?? 320}px"
						></iframe>
					</div>
				{/each}
			</section>
		{/each}
	</main>
</div>
