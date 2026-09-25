<script lang="ts">
	// Просмотр PDF без скачивания: страницы рисуются в canvas (pdf.js, локальный воркер), ссылки на файл в разметке нет.
	// Масштаб «по ширине» + ручной зум; страницы рендерятся лениво при прокрутке.
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import { Refresh, ZoomIn, ZoomOut } from '@lct-testkit/rt-ui/icons';
	import Btn from '$lib/ui/Btn.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import PdfPage from './PdfPage.svelte';
	import { fetchPdfBytes, openPdf, pageSizes, type PageSize } from './pdf';
	import { ZOOM_MAX, ZOOM_MIN, fitScale, zoomIn, zoomOut } from './pdf-layout';
	import { previewUrlForFetch } from './urls';

	let { url, class: className = '' }: { url: string; class?: string } = $props();

	const PAD = 8;
	const GAP = 8;

	let pdf = $state.raw<PDFDocumentProxy | null>(null);
	let sizes = $state.raw<PageSize[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let attempt = $state(0);
	let zoom = $state(1);
	let box = $state<HTMLDivElement | null>(null);
	let boxWidth = $state(0);
	let current = $state(1);

	$effect(() => {
		const target = url;
		void attempt;
		const ctrl = new AbortController();
		let doc: PDFDocumentProxy | null = null;
		status = 'loading';
		pdf = null;
		(async () => {
			try {
				let bytes: ArrayBuffer;
				try {
					bytes = await fetchPdfBytes(target, ctrl.signal);
				} catch (e) {
					// прямой запрос к хранилищу мог упереться в CORS/CSP: пробуем тот же путь через свой origin (прокси бакетов)
					const alt = previewUrlForFetch(target, location.origin, [new URL(target).origin]);
					if (ctrl.signal.aborted || alt === target) throw e;
					bytes = await fetchPdfBytes(alt, ctrl.signal);
				}
				doc = await openPdf(bytes);
				if (ctrl.signal.aborted) return;
				sizes = await pageSizes(doc);
				pdf = doc;
				status = 'ready';
			} catch {
				if (!ctrl.signal.aborted) status = 'error';
			}
		})();
		return () => {
			ctrl.abort();
			void doc?.loadingTask.destroy();
		};
	});

	const widest = $derived(sizes.reduce((max, s) => Math.max(max, s.widthPt), 0));
	const scale = $derived(fitScale(widest, boxWidth, PAD) * zoom);
	const pages = $derived(sizes.map((s) => ({ width: Math.floor(s.widthPt * scale), height: Math.floor(s.heightPt * scale) })));

	function onscroll() {
		if (!box) return;
		const probe = box.scrollTop + box.clientHeight / 3;
		let top = PAD;
		let index = 1;
		for (let i = 0; i < pages.length; i += 1) {
			index = i + 1;
			if (probe < top + pages[i].height + GAP) break;
			top += pages[i].height + GAP;
		}
		current = index;
	}
</script>

<div class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface {className}">
	<div class="flex flex-none items-center gap-1 border-b border-line px-3 py-1">
		<span class="t-desc-l text-muted tabular-nums">{status === 'ready' ? `Стр. ${current} из ${pages.length}` : 'Документ'}</span>
		<span class="ml-auto"></span>
		<IconBtn icon={ZoomOut} label="Уменьшить" size="s" disabled={status !== 'ready' || zoom <= ZOOM_MIN} onclick={() => (zoom = zoomOut(zoom))} />
		<Btn
			label={`${Math.round(zoom * 100)}%`}
			size="s"
			variant="ghost"
			colorScheme="neutral"
			class="min-w-14 tabular-nums"
			aria-label="Сбросить масштаб"
			title="Сбросить масштаб"
			disabled={status !== 'ready'}
			onclick={() => (zoom = 1)}
		/>
		<IconBtn icon={ZoomIn} label="Увеличить" size="s" disabled={status !== 'ready' || zoom >= ZOOM_MAX} onclick={() => (zoom = zoomIn(zoom))} />
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={box}
		bind:clientWidth={boxWidth}
		{onscroll}
		oncontextmenu={(e) => e.preventDefault()}
		role="region"
		tabindex="0"
		class="h-[min(72dvh,920px)] touch-pan-x touch-pan-y touch-pinch-zoom overflow-auto overscroll-contain bg-surface-3 p-2 select-none max-md:h-[62dvh] [@media(max-height:500px)]:h-[78dvh]"
		aria-label="Просмотр документа"
	>
		{#if status === 'loading'}
			<div class="p-2"><Skeleton kind="lines" rows={9} /></div>
		{:else if status === 'error'}
			<div class="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
				<p class="t-body-m m-0 text-muted">Не удалось показать документ</p>
				<Btn label="Повторить" icon={Refresh} variant="outline" colorScheme="neutral" onclick={() => attempt++} />
			</div>
		{:else if pdf}
			<div class="flex w-max min-w-full flex-col gap-2">
				{#each pages as p, i (i)}
					<PdfPage {pdf} n={i + 1} {scale} width={p.width} height={p.height} root={box} />
				{/each}
			</div>
		{/if}
	</div>
</div>
