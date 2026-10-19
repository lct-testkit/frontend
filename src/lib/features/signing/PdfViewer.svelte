<script lang="ts">
	// Просмотр PDF без скачивания: страницы рисуются в canvas (pdf.js, локальный воркер), ссылки на файл в разметке нет.
	// Масштаб «по ширине» + ручной зум; страницы рендерятся лениво при прокрутке.
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import { Refresh, ZoomIn, ZoomOut } from '@lct-testkit/rt-ui/icons';
	import Btn from '$lib/ui/Btn.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import PdfPage from './PdfPage.svelte';
	import { pdfLoadError, pdfRateLimitText } from './errors';
	import { openPdf, pageSizes, type PageSize } from './pdf';
	import { ZOOM_MAX, ZOOM_MIN, fitScale, zoomIn, zoomOut } from './pdf-layout';

	/** `load` отдаёт байты PDF (с origin приложения через клиент `api`); кэш и лимит ссылки — забота вызывающего (`SignSession.loadPdf`). */
	let { load, class: className = '' }: { load: (signal: AbortSignal) => Promise<ArrayBuffer>; class?: string } = $props();

	const PAD = 8;
	const GAP = 8;

	let pdf = $state.raw<PDFDocumentProxy | null>(null);
	let sizes = $state.raw<PageSize[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let attempt = $state(0);
	let errorText = $state('Не удалось показать документ');
	/** 429: сколько секунд осталось до разрешённого повтора (`limited` — ошибка именно лимит, 0 — можно повторить) */
	let limited = $state(false);
	let waitSeconds = $state(0);
	let zoom = $state(1);
	let box = $state<HTMLDivElement | null>(null);
	let boxWidth = $state(0);
	let current = $state(1);

	// обратный отсчёт после 429: «Повторить» заблокирована, пока не пройдёт Retry-After
	$effect(() => {
		if (waitSeconds <= 0) return;
		const timer = setInterval(() => (waitSeconds = Math.max(0, waitSeconds - 1)), 1000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		const source = load;
		void attempt;
		const ctrl = new AbortController();
		let doc: PDFDocumentProxy | null = null;
		status = 'loading';
		pdf = null;
		(async () => {
			try {
				const bytes = await source(ctrl.signal);
				if (ctrl.signal.aborted) return;
				doc = await openPdf(bytes);
				if (ctrl.signal.aborted) return;
				sizes = await pageSizes(doc);
				pdf = doc;
				status = 'ready';
			} catch (e) {
				if (ctrl.signal.aborted) return;
				const failure = pdfLoadError(e);
				errorText = failure.message;
				limited = failure.retryAfter !== undefined;
				waitSeconds = failure.retryAfter ?? 0;
				status = 'error';
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
		<IconBtn icon={ZoomOut} label="Уменьшить" size="s" class="max-md:min-h-11 max-md:min-w-11" disabled={status !== 'ready' || zoom <= ZOOM_MIN} onclick={() => (zoom = zoomOut(zoom))} />
		<Btn
			label={`${Math.round(zoom * 100)}%`}
			size="s"
			variant="ghost"
			colorScheme="neutral"
			class="min-w-14 tabular-nums max-md:min-h-11 pointer-coarse:min-h-11"
			aria-label="Сбросить масштаб"
			title="Сбросить масштаб"
			disabled={status !== 'ready'}
			onclick={() => (zoom = 1)}
		/>
		<IconBtn icon={ZoomIn} label="Увеличить" size="s" class="max-md:min-h-11 max-md:min-w-11" disabled={status !== 'ready' || zoom >= ZOOM_MAX} onclick={() => (zoom = zoomIn(zoom))} />
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
				<p class="t-body-m m-0 text-muted" data-testid="pdf-error">
					{#if limited}{waitSeconds > 0 ? pdfRateLimitText(waitSeconds) : 'Лимит снят, можно повторить'}{:else}{errorText}{/if}
				</p>
				<Btn label="Повторить" icon={Refresh} variant="outline" colorScheme="neutral" disabled={waitSeconds > 0} onclick={() => attempt++} />
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
