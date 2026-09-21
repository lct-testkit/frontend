<script lang="ts">
	// Одна страница PDF в canvas. Рисуется лениво: только когда попала в зону видимости (запас — окно целиком),
	// и перерисовывается при смене масштаба.
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import { renderPage } from './pdf';

	interface Props {
		pdf: PDFDocumentProxy;
		n: number;
		scale: number;
		width: number;
		height: number;
		root: HTMLElement | null;
	}

	let { pdf, n, scale, width, height, root }: Props = $props();

	let host = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let visible = $state(false);

	$effect(() => {
		if (!host) return;
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { root, rootMargin: '100% 0px' });
		observer.observe(host);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!visible || !canvas) return;
		const target = canvas;
		const factor = scale;
		let stopped = false;
		let cancel = () => {};
		pdf.getPage(n).then((page) => {
			if (!stopped) cancel = renderPage(page, target, factor, window.devicePixelRatio || 1);
		});
		return () => {
			stopped = true;
			cancel();
		};
	});
</script>

<div bind:this={host} class="relative mx-auto flex-none bg-white shadow-s" style="width:{width}px;height:{height}px" data-page={n}>
	<canvas bind:this={canvas} class="block"></canvas>
</div>
