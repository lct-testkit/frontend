import { describe, expect, it } from 'vitest';
import { isoDate, periodFor, presetOf } from './period';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('быстрые периоды', () => {
	it('этот месяц: с первого числа по сегодня', () => {
		expect(periodFor('this_month', day(2026, 10, 16))).toEqual({ date_from: '2026-10-01', date_to: '2026-10-16' });
	});

	it('прошлый месяц целиком, в том числе через границу года', () => {
		expect(periodFor('prev_month', day(2026, 1, 10))).toEqual({ date_from: '2025-12-01', date_to: '2025-12-31' });
		expect(periodFor('prev_month', day(2026, 3, 5))).toEqual({ date_from: '2026-02-01', date_to: '2026-02-28' });
	});

	it('квартал: октябрь начинает четвёртый, ноябрь и декабрь тоже', () => {
		expect(periodFor('this_quarter', day(2026, 10, 16))?.date_from).toBe('2026-10-01');
		expect(periodFor('this_quarter', day(2026, 5, 2))?.date_from).toBe('2026-04-01');
		expect(periodFor('this_quarter', day(2026, 3, 31))?.date_from).toBe('2026-01-01');
	});

	it('с начала года; «всё время» — без дат', () => {
		expect(periodFor('this_year', day(2026, 10, 16))).toEqual({ date_from: '2026-01-01', date_to: '2026-10-16' });
		expect(periodFor('all', day(2026, 10, 16))).toBeNull();
	});

	it('дата берётся по локальному календарю', () => {
		expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
	});

	it('presetOf узнаёт пресет по датам, иначе null', () => {
		const today = day(2026, 10, 16);
		expect(presetOf('2026-10-01', '2026-10-16', today)).toBe('this_month');
		expect(presetOf(undefined, undefined, today)).toBe('all');
		expect(presetOf('2026-09-05', '2026-09-20', today)).toBeNull();
	});
});
