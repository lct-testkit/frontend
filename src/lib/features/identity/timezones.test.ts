import { describe, expect, it } from 'vitest';
import { timezoneHuman, timezoneLabel, timezoneOptions } from './timezones';

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

describe('timezoneHuman («UTC+7 (Барнаул)»)', () => {
	it.each([
		['Asia/Barnaul', 'UTC+7 (Барнаул)'],
		['Europe/Moscow', 'UTC+3 (Москва)'],
		['Europe/Kaliningrad', 'UTC+2 (Калининград)'],
		['Asia/Kamchatka', 'UTC+12 (Камчатка)'],
		['Asia/Novokuznetsk', 'UTC+7 (Новокузнецк)'],
		['Europe/Samara', 'UTC+4 (Самара)'],
		['Asia/Kolkata', 'UTC+5:30 (Kolkata)'],
		['America/New_York', /^UTC[+−-]\d \(New York\)$/],
		['UTC', 'UTC (UTC)']
	])('%s', (zone, expected) => {
		const label = timezoneHuman(zone);
		if (expected instanceof RegExp) expect(label).toMatch(expected);
		else expect(label).toBe(expected);
	});
	it('пусто и незнакомая зона', () => {
		expect(timezoneHuman(null)).toBe('—');
		expect(timezoneHuman('')).toBe('—');
		expect(timezoneHuman('Mars/Olympus')).toBe('Mars/Olympus');
	});
	it('у каждой зоны России, что отдаёт бэкенд, есть русский город', () => {
		for (const zone of ['Asia/Anadyr', 'Asia/Chita', 'Europe/Kirov', 'Europe/Saratov', 'Europe/Simferopol', 'Europe/Ulyanovsk', 'Europe/Volgograd', 'Asia/Sakhalin', 'Asia/Tomsk', 'Asia/Novosibirsk']) {
			expect(timezoneHuman(zone)).toMatch(/^UTC\+\d+ \([А-Яа-яЁё -]+\)$/);
		}
	});
});
