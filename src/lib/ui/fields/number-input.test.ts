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
		expect(sanitizeNumber('1,5', { integer: true })).toBe('1');
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

describe('sanitizeNumber: what is shown is what is sent (D-9)', () => {
	it('a minus never gets into a field that does not allow negatives', () => {
		expect(sanitizeNumber('-1000', { negative: false })).toBe('1000');
		expect(sanitizeNumber('−5abc', { negative: false, integer: true })).toBe('5');
	});

	it('an integer field does not glue the fraction to the whole', () => {
		expect(sanitizeNumber('12,5', { integer: true })).toBe('12');
		expect(sanitizeNumber('1 250,50', { integer: true })).toBe('1250');
	});

	it('the integer part is cut at maxInt digits (a number that would turn into 1e+21 never stays)', () => {
		expect(sanitizeNumber('99999999999999999999999')).toHaveLength(15);
		expect(sanitizeNumber('1234567890123', { maxInt: 12 })).toBe('123456789012');
		expect(sanitizeNumber('1234567890123,5', { maxInt: 12 })).toBe('123456789012,5');
	});

	it('the fraction is cut at maxFrac digits', () => {
		expect(sanitizeNumber('10,999', { maxFrac: 2 })).toBe('10,99');
		expect(sanitizeNumber('10,', { maxFrac: 2 })).toBe('10,');
		expect(sanitizeNumber('10,5', { maxFrac: 0 })).toBe('10');
	});
});

