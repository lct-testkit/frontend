import { describe, expect, it } from 'vitest';
import { bannerText, chainNote, exportNote, formatAge, mergeHead, occurredAt, parsePending, pendingState, pollDelay } from './pending';

const queue = (count: unknown, age: unknown = 0) => ({ delivery: 'queue', pending: { count, oldest_age_seconds: age } });

describe('parsePending', () => {
	it('полный ответ', () => expect(parsePending(queue(12, 3.4))).toEqual({ count: 12, oldestAgeSeconds: 3.4 }));
	it('поля нет, режим sync, не объект', () => {
		expect(parsePending({ items: [] })).toBeNull();
		expect(parsePending({ delivery: 'sync', pending: { count: 3 } })).toBeNull();
		expect(parsePending(null)).toBeNull();
		expect(parsePending({ delivery: 'queue' })).toBeNull();
	});
	it('отрицательное число, NaN и строка вместо числа', () => {
		expect(parsePending(queue(-1))).toBeNull();
		expect(parsePending(queue(Number.NaN))).toBeNull();
		expect(parsePending(queue('12'))).toBeNull();
		expect(parsePending(queue(2, -5))).toEqual({ count: 2, oldestAgeSeconds: 0 });
		expect(parsePending(queue(2, 'давно'))).toEqual({ count: 2, oldestAgeSeconds: 0 });
	});
});

describe('pendingState', () => {
	it('0, 5 с, ровно 30 с, 31 с', () => {
		expect(pendingState(null)).toBe('off');
		expect(pendingState({ count: 0, oldestAgeSeconds: 0 })).toBe('sealed');
		expect(pendingState({ count: 3, oldestAgeSeconds: 5 })).toBe('sealing');
		expect(pendingState({ count: 3, oldestAgeSeconds: 30 })).toBe('sealing');
		expect(pendingState({ count: 3, oldestAgeSeconds: 31 })).toBe('delayed');
	});
});

describe('pollDelay', () => {
	const sealed = { count: 0, oldestAgeSeconds: 0 };
	const sealing = { count: 2, oldestAgeSeconds: 4 };
	const delayed = { count: 2, oldestAgeSeconds: 90 };
	it('выключено и скрытая вкладка — не опрашивать', () => {
		expect(pollDelay(null, false, 0)).toBeNull();
		expect(pollDelay(sealing, true, 0)).toBeNull();
	});
	it('3, 10 и 15 секунд', () => {
		expect(pollDelay(sealing, false, 0)).toBe(3000);
		expect(pollDelay(delayed, false, 0)).toBe(10000);
		expect(pollDelay(sealed, false, 0)).toBe(15000);
	});
	it('после 10 минут ожидания — 30 с', () => {
		expect(pollDelay(sealing, false, 10 * 60 * 1000)).toBe(30000);
		expect(pollDelay(delayed, false, 11 * 60 * 1000)).toBe(30000);
		expect(pollDelay(sealed, false, 11 * 60 * 1000)).toBe(15000);
	});
});

describe('formatAge', () => {
	it('примеры', () => {
		expect(formatAge(0.4)).toBe('меньше секунды');
		expect(formatAge(4.2)).toBe('4 с');
		expect(formatAge(75)).toBe('1 мин 15 с');
		expect(formatAge(130)).toBe('2 мин 10 с');
		expect(formatAge(120)).toBe('2 мин');
		expect(formatAge(7300)).toBe('2 ч 1 мин');
		expect(formatAge(7200)).toBe('2 ч');
	});
});

describe('mergeHead', () => {
	const r = (id: string) => ({ id });
	it('новые строки сверху без повторов', () => {
		expect(mergeHead([r('b'), r('c')], [r('a'), r('b')])).toEqual({ items: [r('a'), r('b'), r('c')], gap: false });
	});
	it('ничего нового — список как был', () => expect(mergeHead([r('a')], [r('a')])).toEqual({ items: [r('a')], gap: false }));
	it('нет пересечения — разрыв', () => expect(mergeHead([r('x')], [r('a'), r('b')]).gap).toBe(true));
	it('пустой текущий список', () => expect(mergeHead([], [r('a')])).toEqual({ items: [r('a')], gap: false }));
});

describe('exportNote, chainNote, bannerText, occurredAt', () => {
	it('exportNote: с числом и без заголовка', () => {
		expect(exportNote('12')).toBe('Не вошло ожидающих: 12');
		expect(exportNote(null)).toBeNull();
		expect(exportNote('0')).toBeNull();
		expect(exportNote('abc')).toBeNull();
	});
	it('chainNote', () => {
		expect(chainNote({ count: 12, oldestAgeSeconds: 4 })).toBe('Не вошло в проверку: 12 событий ждут запечатывания, самое старое — 4 с');
		expect(chainNote({ count: 0, oldestAgeSeconds: 0 })).toBeNull();
		expect(chainNote(null)).toBeNull();
	});
	it('bannerText: запечатывается, задерживается, нет плашки', () => {
		expect(bannerText({ count: 12, oldestAgeSeconds: 4 })?.title).toBe('Ожидают запечатывания: 12');
		expect(bannerText({ count: 12, oldestAgeSeconds: 130 })?.title).toBe('Запечатывание задерживается: 12 событий ждут 2 мин 10 с');
		expect(bannerText({ count: 1, oldestAgeSeconds: 40 })?.title).toBe('Запечатывание задерживается: 1 событие ждёт 40 с');
		expect(bannerText({ count: 0, oldestAgeSeconds: 0 })).toBeNull();
		expect(bannerText(null)).toBeNull();
	});
	it('occurredAt: occurred_at, иначе created_at', () => {
		expect(occurredAt({ created_at: '2026-10-16T09:00:03Z' })).toEqual({ event: '2026-10-16T09:00:03Z', sealed: null });
		expect(occurredAt({ created_at: '2026-10-16T09:00:03Z', occurred_at: '2026-10-16T09:00:01Z' } as { created_at: string })).toEqual({ event: '2026-10-16T09:00:01Z', sealed: '2026-10-16T09:00:03Z' });
	});
});
