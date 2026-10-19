import { describe, expect, it } from 'vitest';
import { sanitizeNumber } from './number-input';

describe('sanitizeNumber', () => {
	it('drops letters, so text never stays in an amount field', () => {
		expect(sanitizeNumber('abc')).toBe('');
		expect(sanitizeNumber('1a')).toBe('1');
		expect(sanitizeNumber('12e3')).toBe('123');
		expect(sanitizeNumber('сто тысяч')).toBe('');
	});

	it('keeps one decimal separator', () => {
		expect(sanitizeNumber('1,5,7')).toBe('1,57');
		expect(sanitizeNumber('1.5.')).toBe('1.5');
		expect(sanitizeNumber('1,5', { integer: true })).toBe('15');
	});

	it('takes a pasted amount with spaces', () => {
		expect(sanitizeNumber('1 250 000,50')).toBe('1250000,50');
		expect(sanitizeNumber('1\u00a0250')).toBe('1250');
	});

	it('keeps a minus only at the start and only when negatives are allowed', () => {
		expect(sanitizeNumber('-5')).toBe('-5');
		expect(sanitizeNumber('−5')).toBe('-5');
		expect(sanitizeNumber('5-')).toBe('5');
		expect(sanitizeNumber('--5')).toBe('-5');
		expect(sanitizeNumber('-5', { negative: false })).toBe('5');
	});
});
