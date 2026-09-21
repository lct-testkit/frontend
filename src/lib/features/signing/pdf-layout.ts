// Чистая геометрия просмотрщика PDF (тестируется без DOM).

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

/** Масштаб, при котором страница шириной `pageWidthPt` (в единицах PDF, 1 pt) занимает `containerPx`. */
export function fitScale(pageWidthPt: number, containerPx: number, padding = 0): number {
	if (pageWidthPt <= 0 || containerPx <= 0) return 1;
	const usable = Math.max(1, containerPx - padding * 2);
	return clampZoom(usable / pageWidthPt);
}

export const clampZoom = (zoom: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

export const zoomIn = (zoom: number): number => clampZoom(Math.round((zoom + ZOOM_STEP) * 100) / 100);
export const zoomOut = (zoom: number): number => clampZoom(Math.round((zoom - ZOOM_STEP) * 100) / 100);

/** Размер canvas в CSS-пикселях и в физических (devicePixelRatio) для чёткого текста. */
export function canvasSize(widthPt: number, heightPt: number, scale: number, dpr: number) {
	const cssWidth = Math.floor(widthPt * scale);
	const cssHeight = Math.floor(heightPt * scale);
	const ratio = Math.max(1, Math.min(3, dpr || 1));
	return {
		cssWidth,
		cssHeight,
		pixelWidth: Math.floor(cssWidth * ratio),
		pixelHeight: Math.floor(cssHeight * ratio),
		ratio
	};
}

/** Какие страницы рендерить: видимые плюс запас по одной с каждой стороны. */
export function visiblePages(
	pageTops: readonly number[],
	pageHeights: readonly number[],
	scrollTop: number,
	viewportHeight: number,
	overscan = 1
): number[] {
	const result: number[] = [];
	const from = scrollTop - overscan * viewportHeight;
	const to = scrollTop + viewportHeight * (1 + overscan);
	for (let i = 0; i < pageTops.length; i += 1) {
		const top = pageTops[i];
		const bottom = top + (pageHeights[i] ?? 0);
		if (bottom >= from && top <= to) result.push(i + 1);
	}
	return result;
}
