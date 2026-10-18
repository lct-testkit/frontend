import { describe, expect, it } from 'vitest';
import { formatHours } from './format';

describe('formatHours', () => {
	it('доли часа — минуты', () => {
		expect(formatHours(0.05)).toBe('3 мин');
		expect(formatHours(0.15)).toBe('9 мин');
		expect(formatHours(0.001)).toBe('1 мин');
	});
	it('часы и дни', () => {
		expect(formatHours(1)).toBe('1 ч');
		expect(formatHours(36)).toBe('36 ч');
		expect(formatHours(72)).toBe('3 дн.');
		expect(formatHours(1.5)).toBe('1,5 ч');
	});
});
