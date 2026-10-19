import { describe, expect, it } from 'vitest';
import { isPastDay } from './date-past';

const NOW = new Date(2026, 9, 20, 14, 30);

describe('isPastDay', () => {
	it('вчера и раньше — прошлое', () => {
		expect(isPastDay('2026-10-19', NOW)).toBe(true);
		expect(isPastDay('2020-03-02', NOW)).toBe(true);
	});
	it('сегодня и позже — нет, даже вечером', () => {
		expect(isPastDay('2026-10-20', NOW)).toBe(false);
		expect(isPastDay('2026-10-20', new Date(2026, 9, 20, 23, 59))).toBe(false);
		expect(isPastDay('2026-10-21', NOW)).toBe(false);
	});
	it('пусто и мусор — не прошлое', () => {
		expect(isPastDay(null, NOW)).toBe(false);
		expect(isPastDay('', NOW)).toBe(false);
		expect(isPastDay('вчера', NOW)).toBe(false);
	});
});
