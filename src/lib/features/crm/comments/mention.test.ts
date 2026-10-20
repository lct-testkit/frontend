import { describe, expect, it } from 'vitest';
import { insertMention, mentionQuery, mentionsInText } from './mention';

describe('mentionQuery', () => {
	it.each([
		['@', ''],
		['@Пет', 'Пет'],
		['Привет, @Пет', 'Пет'],
		['строка\n@Ив', 'Ив'],
		['@Петров ', null],
		['без упоминаний', null],
		['почта a@b.ru', null],
		['', null],
		['@@', null]
	])('%j → %j', (text, query) => {
		expect(mentionQuery(text)).toBe(query);
	});
});

describe('insertMention', () => {
	it('заменяет набранное «@Пет» выбранным именем', () => {
		expect(insertMention('Привет, @Пет', 'Пётр Петров')).toBe('Привет, @Пётр Петров ');
		expect(insertMention('@', 'Пётр Петров')).toBe('@Пётр Петров ');
		expect(insertMention('текст\n@Ив', 'Иван')).toBe('текст\n@Иван ');
	});
	it('без набранного «@» дописывает в конец (кнопка «@»)', () => {
		expect(insertMention('', 'Иван')).toBe('@Иван ');
		expect(insertMention('Привет', 'Иван')).toBe('Привет @Иван ');
		expect(insertMention('Привет ', 'Иван')).toBe('Привет @Иван ');
	});
});

describe('mentionsInText', () => {
	const names: Record<string, string> = { a: 'Пётр Петров', b: 'Иван Иванов' };
	it('оставляет тех, чьё «@Имя» ещё в тексте, без дублей', () => {
		expect(mentionsInText('Привет @Пётр Петров и @Иван Иванов', ['a', 'b', 'a'], (id) => names[id]!)).toEqual(['a', 'b']);
		expect(mentionsInText('Привет @Пётр Петров', ['a', 'b'], (id) => names[id]!)).toEqual(['a']);
		expect(mentionsInText('Привет', ['a'], (id) => names[id]!)).toEqual([]);
	});
});
