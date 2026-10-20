import { describe, expect, it } from 'vitest';
import { currencyItems, DEFAULT_CURRENCY } from './currencies';
import { maxLengthError } from './custom-fields';

describe('maxLengthError', () => {
	it.each([
		[null, null],
		[1, null],
		[255, null],
		[0, 'Целое число, не меньше 1'],
		[-1, 'Целое число, не меньше 1'],
		[1.5, 'Целое число, не меньше 1']
	])('%s → %s', (value, error) => {
		expect(maxLengthError(value)).toBe(error);
	});
});

describe('currencyItems', () => {
	it('RUB по умолчанию и первая в списке, есть USD, EUR, CNY', () => {
		expect(DEFAULT_CURRENCY).toBe('RUB');
		expect(currencyItems('RUB').map((i) => i.key)).toEqual(['RUB', 'USD', 'EUR', 'CNY']);
	});
	it('валюта сохранённого продукта вне списка остаётся в нём первой', () => {
		expect(currencyItems('kzt').map((i) => i.key)).toEqual(['KZT', 'RUB', 'USD', 'EUR', 'CNY']);
		expect(currencyItems(null).map((i) => i.key)).toEqual(['RUB', 'USD', 'EUR', 'CNY']);
	});
});
