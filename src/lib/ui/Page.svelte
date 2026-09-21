<script lang="ts">
	// Page body inside the shell (the shell's <main> scrolls). ONE frame for every page: full width, the same padding from the side menu and the
	// top bar (24 px on a desktop, 16 on a tablet, 12 on a phone) and 16 px between blocks (12 on a phone) — as in the DS CRM example. A page never
	// centres itself, so the left edge of every screen is on the same line as the search field of the top bar.
	// `fill` = a full-height flex column (tables that scroll inside); `narrow` = a readable width for forms and text, still on the left axis;
	// `wide` is kept for callers and changes nothing.
	import type { Snippet } from 'svelte';

	let {
		children,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		wide = false,
		fill = false,
		narrow = false,
		class: className = ''
	}: { children?: Snippet; wide?: boolean; fill?: boolean; narrow?: boolean; class?: string } = $props();
</script>

<div
	class={[
		'flex w-full min-w-0 flex-col gap-4 p-6 max-lg:p-4 max-md:gap-3 max-md:p-3',
		narrow && 'max-w-3xl',
		fill && 'md:h-full md:min-h-0',
		className
	]}
>
	{@render children?.()}
</div>
