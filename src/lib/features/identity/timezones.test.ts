import { describe, expect, it } from 'vitest';
import { timezoneLabel, timezoneOptions } from './timezones';

describe('timezoneLabel', () => {
	it('пояс России по-русски со смещением, незнакомый — как есть, пустой — прочерк', () => {
		expect(timezoneLabel('Europe/Moscow')).toBe('Москва, UTC+3');
		expect(timezoneLabel('Asia/Vladivostok')).toBe('Владивосток, UTC+10');
		expect(timezoneLabel('America/New_York')).toBe('America/New_York');
		expect(timezoneLabel(null)).toBe('—');
	});
	it('список для выбора: ключ — IANA, подпись — русская; текущее значение вне списка остаётся', () => {
		const items = timezoneOptions('Europe/Moscow');
		expect(items.find((i) => i.key === 'Europe/Moscow')?.value).toBe('Москва, UTC+3');
		expect(timezoneOptions('Asia/Tokyo')[0]).toEqual({ key: 'Asia/Tokyo', value: 'Asia/Tokyo' });
	});
});
