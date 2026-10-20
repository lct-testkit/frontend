import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { ReportPreview } from './preview.svelte';
import { previewText } from './preview';

const answer = (row_count: number, exact = true) => ({ row_count, exact });
/** запрос, который отвечает, когда скажем */
function pending() {
	let resolve!: (v: { row_count: number; exact: boolean }) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<{ row_count: number; exact: boolean }>((res, rej) => ((resolve = res), (reject = rej)));
	return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ReportPreview: пауза и отмена', () => {
	it('спрашивает через 400 мс после последней правки, а не на каждую', async () => {
		const fetch = vi.fn().mockResolvedValue(answer(7));
		const p = new ReportPreview({ fetch });
		p.request('deal_register', { limit: 10 });
		await vi.advanceTimersByTimeAsync(300);
		p.request('deal_register', { limit: 100 });
		await vi.advanceTimersByTimeAsync(300);
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(150);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0].slice(0, 2)).toEqual(['deal_register', { limit: 100 }]);
		expect(p.rows).toBe(7);
		expect(p.phase).toBe('ready');
	});

	it('тот же набор параметров второй раз не спрашивает', async () => {
		const fetch = vi.fn().mockResolvedValue(answer(3));
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(500);
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(500);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('устаревший ответ не затирает свежий: правка во время запроса отменяет его', async () => {
		const first = pending();
		const second = pending();
		const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		const signal = fetch.mock.calls[0][2] as AbortSignal;
		p.request('x', { a: 2 });
		expect(signal.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(450);
		second.resolve(answer(20));
		await vi.advanceTimersByTimeAsync(0);
		first.resolve(answer(999)); // опоздавший ответ на прошлые параметры
		await vi.advanceTimersByTimeAsync(0);
		expect(p.rows).toBe(20);
	});

	it('прошлое число остаётся, пока считается новое', async () => {
		const next = pending();
		const fetch = vi.fn().mockResolvedValueOnce(answer(5)).mockReturnValueOnce(next.promise);
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		p.request('x', { a: 2 });
		expect(p.phase).toBe('loading');
		expect(p.rows).toBe(5);
		await vi.advanceTimersByTimeAsync(450);
		next.resolve(answer(6, false));
		await vi.advanceTimersByTimeAsync(0);
		expect([p.rows, p.exact, p.phase]).toEqual([6, false, 'ready']);
	});

	it('clear отменяет запрос и прячет число', async () => {
		const wait = pending();
		const fetch = vi.fn().mockReturnValue(wait.promise);
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		const signal = fetch.mock.calls[0][2] as AbortSignal;
		p.clear();
		expect(signal.aborted).toBe(true);
		expect([p.phase, p.rows]).toEqual(['idle', null]);
		wait.resolve(answer(4));
		await vi.advanceTimersByTimeAsync(0);
		expect(p.rows).toBeNull();
	});
});

describe('ReportPreview: сбои не ломают форму', () => {
	it('ошибка сервера — число прячется, исключения наружу нет', async () => {
		const fetch = vi.fn().mockRejectedValue(new ApiError({ status: 500, detail: 'boom' }));
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		expect([p.phase, p.rows]).toEqual(['unavailable', null]);
	});

	it('старый бэкенд без ручки (404) — тоже просто нет строки', async () => {
		const fetch = vi.fn().mockRejectedValue(new ApiError({ status: 404, detail: 'Not Found' }));
		const p = new ReportPreview({ fetch });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		expect(p.phase).toBe('unavailable');
	});

	it('долгий ответ обрывается по таймауту', async () => {
		const fetch = vi.fn((_c: string, _p: Record<string, unknown>, signal?: AbortSignal) => new Promise<never>((_, rej) => signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))));
		const p = new ReportPreview({ fetch, timeout: 2000 });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		expect(p.phase).toBe('loading');
		await vi.advanceTimersByTimeAsync(2100);
		expect(p.phase).toBe('unavailable');
	});

	it('429: не спрашивает снова, пока не пройдёт Retry-After', async () => {
		let t = 1_000_000;
		const fetch = vi.fn().mockRejectedValueOnce(new ApiError({ status: 429, detail: 'Слишком много запросов', retryAfter: 20 })).mockResolvedValue(answer(9));
		const p = new ReportPreview({ fetch, now: () => t });
		p.request('x', { a: 1 });
		await vi.advanceTimersByTimeAsync(450);
		expect(p.phase).toBe('unavailable');
		p.request('x', { a: 2 });
		expect(p.phase).toBe('unavailable'); // «Считаем…» не показываем: число не придёт
		await vi.advanceTimersByTimeAsync(5000);
		expect(fetch).toHaveBeenCalledTimes(1);
		t += 20_000;
		await vi.advanceTimersByTimeAsync(16_000);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(p.rows).toBe(9);
	});
});

describe('previewText', () => {
	it('считается, числа ещё нет — «Считаем строки…»', () => {
		expect(previewText(null, true, null, 'loading')).toMatchObject({ kind: 'loading', text: 'Считаем строки…' });
	});
	it('сбой и покой — ничего', () => {
		expect(previewText(null, true, null, 'unavailable').kind).toBe('none');
		expect(previewText(5, true, null, 'idle').kind).toBe('none');
	});
	it('ноль — предупреждение с советом', () => {
		expect(previewText(0, true, null, 'ready')).toMatchObject({ kind: 'empty', text: 'По этим условиям строк нет — расширьте период или уберите фильтры', stale: false });
	});
	it('точное число и оценка', () => {
		expect(previewText(42, true, null, 'ready')).toMatchObject({ text: 'Найдётся 42 строки' });
		expect(previewText(1200, false, null, 'ready')).toMatchObject({ text: 'Найдётся ≈ 1 200 строк' });
		expect(previewText(21, true, null, 'ready')).toMatchObject({ text: 'Найдётся 21 строка' });
	});
	it('больше лимита — сказать, сколько войдёт в отчёт', () => {
		expect(previewText(5000, true, 1000, 'ready')).toMatchObject({ text: 'Найдётся 5 000 строк, в отчёт войдут первые 1 000' });
		expect(previewText(1000, true, 1000, 'ready')).toMatchObject({ text: 'Найдётся 1 000 строк' });
	});
	it('пока считается новое, прошлое число приглушено', () => {
		expect(previewText(3, true, null, 'loading')).toMatchObject({ kind: 'count', stale: true });
		expect(previewText(0, true, null, 'loading')).toMatchObject({ kind: 'empty', stale: true });
	});
});
