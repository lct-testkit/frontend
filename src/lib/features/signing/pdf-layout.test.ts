import { describe, expect, it } from 'vitest';
import { canvasSize, clampZoom, fitScale, visiblePages, zoomIn, zoomOut } from './pdf-layout';

describe('fitScale / zoom', () => {
	it('подгоняет A4 (595 pt) под контейнер', () => {
		expect(fitScale(595, 595)).toBeCloseTo(1, 5);
		expect(fitScale(595, 360, 16)).toBeCloseTo(328 / 595, 5);
	});
	it('ограничивает диапазон', () => {
		expect(fitScale(100, 10_000)).toBe(3);
		expect(fitScale(0, 100)).toBe(1);
		expect(clampZoom(0.1)).toBe(0.5);
	});
	it('шаги масштаба', () => {
		expect(zoomIn(1)).toBe(1.25);
		expect(zoomOut(0.6)).toBe(0.5);
		expect(zoomIn(3)).toBe(3);
	});
});

describe('canvasSize', () => {
	it('учитывает devicePixelRatio и ограничивает его тройкой', () => {
		expect(canvasSize(595, 842, 1, 2)).toMatchObject({ cssWidth: 595, pixelWidth: 1190, ratio: 2 });
		expect(canvasSize(100, 100, 1, 5).ratio).toBe(3);
		expect(canvasSize(100, 100, 1, 0).ratio).toBe(1);
	});
});

describe('visiblePages', () => {
	const tops = [0, 1000, 2000, 3000, 4000];
	const heights = [1000, 1000, 1000, 1000, 1000];
	it('видимые плюс запас', () => {
		expect(visiblePages(tops, heights, 2100, 800, 0)).toEqual([3]);
		expect(visiblePages(tops, heights, 2100, 800, 1)).toEqual([2, 3, 4]);
	});
	it('начало и конец', () => {
		expect(visiblePages(tops, heights, 0, 500, 0)).toEqual([1]);
		expect(visiblePages(tops, heights, 4500, 500, 0)).toEqual([5]);
	});
});
