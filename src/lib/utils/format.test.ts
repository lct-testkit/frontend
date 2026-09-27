import { describe, expect, it } from 'vitest';
import { initials } from './format';

describe('initials', () => {
	it('первые буквы первых двух слов', () => {
		expect(initials('Иван Тесткитович')).toBe('ИТ');
		expect(initials('Дмитрий')).toBe('Д');
	});
	it('слова без буквы в начале пропускаются', () => {
		expect(initials('Демо-отчёты (сид)')).toBe('ДС');
		expect(initials('  Пётр   Петров ')).toBe('ПП');
	});
	it('пусто — знак вопроса', () => {
		expect(initials(null)).toBe('?');
		expect(initials('   ')).toBe('?');
		expect(initials('(?)')).toBe('?');
	});
});
