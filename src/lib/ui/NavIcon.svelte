<script lang="ts">
	// Icon of the side menu, optically normalised. The DS icons sit on a 24 px grid, but their drawn shapes differ in size and place (measured:
	// the bar chart is centred 3 px left of the others, the emblem is 23 px tall, the clipboard 14 px wide), so a column of them looked ragged.
	// The drawn shape is measured once (`getBBox`) and the viewBox is re-framed around it: the ink is centred, and its longer side is 20 of 24 px
	// (a small icon is enlarged by at most 15 %). Every icon of the menu then has the same centre and roughly the same visual weight.
	import type { Component } from 'svelte';

	let { icon }: { icon: Component<any> } = $props(); // eslint-disable-line @typescript-eslint/no-explicit-any

	const Icon = $derived(icon);
	let box = $state<HTMLElement | null>(null);

	$effect(() => {
		void Icon;
		const svg = box?.querySelector('svg');
		if (!svg) return;
		const original = svg.dataset.viewbox ?? svg.getAttribute('viewBox') ?? '0 0 24 24';
		svg.dataset.viewbox = original;
		svg.setAttribute('viewBox', original);
		let bb: DOMRect;
		try {
			bb = svg.getBBox();
		} catch {
			return; // not rendered (hidden): keep the original frame
		}
		if (!bb.width || !bb.height) return;
		const side = Math.max((Math.max(bb.width, bb.height) * 24) / 20, 24 / 1.15);
		svg.setAttribute('viewBox', `${bb.x + bb.width / 2 - side / 2} ${bb.y + bb.height / 2 - side / 2} ${side} ${side}`);
	});
</script>

<span bind:this={box} class="inline-flex size-6 items-center justify-center [&_svg]:size-full" aria-hidden="true"><Icon /></span>
