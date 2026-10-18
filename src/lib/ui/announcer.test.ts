import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce, announcements } from './announcer.svelte';
import { loadingAnnouncement, skeletonMounted } from './skeleton-count.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.runAllTimers();
	vi.useRealTimers();
});

describe('announce', () => {
	it('кладёт текст в вежливую область и стирает через 5 с', async () => {
		announce('Сделка создана');
		await Promise.resolve();
		expect(announcements.polite).toBe('Сделка создана');
		vi.advanceTimersByTime(5001);
		expect(announcements.polite).toBe('');
	});

	it('ошибка идёт в настойчивую область, вежливая пуста', async () => {
		announce('Не удалось сохранить', 'assertive');
		await Promise.resolve();
		expect(announcements.assertive).toBe('Не удалось сохранить');
		expect(announcements.polite).toBe('');
	});

	it('одинаковый текст подряд сбрасывается, чтобы прозвучать дважды', async () => {
		announce('Готово');
		await Promise.resolve();
		announce('Готово');
		expect(announcements.polite).toBe('');
		await Promise.resolve();
		expect(announcements.polite).toBe('Готово');
	});

	it('пустой текст игнорируется', async () => {
		announce('');
		await Promise.resolve();
		expect(announcements.polite).toBe('');
	});
});

describe('скелетоны: «Загрузка» и «Готово»', () => {
	it('быстрая загрузка молчит', () => {
		const off = skeletonMounted();
		vi.advanceTimersByTime(200);
		off();
		vi.advanceTimersByTime(1000);
		expect(loadingAnnouncement.text).toBe('');
	});

	it('долгая: один раз «Загрузка», затем «Готово» при нуле', () => {
		const a = skeletonMounted();
		const b = skeletonMounted();
		vi.advanceTimersByTime(401);
		expect(loadingAnnouncement.text).toBe('Загрузка');
		a();
		vi.advanceTimersByTime(500);
		expect(loadingAnnouncement.text).toBe('Загрузка');
		b();
		vi.advanceTimersByTime(301);
		expect(loadingAnnouncement.text).toBe('Готово');
		vi.advanceTimersByTime(3001);
		expect(loadingAnnouncement.text).toBe('');
	});
});
