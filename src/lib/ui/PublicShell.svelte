<script lang="ts">
	// The frame of the public pages (/sign, /verify, /invite): no menu and no session — the brand, the theme switch and ONE central column. The switch is the icon of the top bar
	// of the app (the same DS control), so a person who came from the app finds the same thing.
	import type { Snippet } from 'svelte';
	import { DarkTheme, Sun } from '@lct-testkit/rt-ui/icons';
	import { theme } from '$lib/stores/theme.svelte';
	import Brand from './Brand.svelte';
	import TopBarIcon from './TopBarIcon.svelte';

	let { children, width = 'md' }: { children?: Snippet; width?: 'sm' | 'md' } = $props();

	const WIDTH = { sm: 'max-w-[560px]', md: 'max-w-[760px]' } as const;
	const label = $derived(theme.mode === 'dark' ? 'Светлая тема' : 'Тёмная тема');
</script>

<div class="flex min-h-dvh flex-col bg-page text-fg">
	<header class="flex h-14 flex-none items-center gap-3 border-b border-line bg-surface px-4 max-md:px-3 [@media(max-height:500px)]:h-11">
		<Brand short />
		<span class="ml-auto"><TopBarIcon icon={theme.mode === 'dark' ? Sun : DarkTheme} {label} onclick={() => theme.toggleMode()} /></span>
	</header>
	<main class="mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-6 max-md:px-3 max-md:py-4 [@media(max-height:500px)]:py-3 {WIDTH[width]}">
		{@render children?.()}
	</main>
</div>
