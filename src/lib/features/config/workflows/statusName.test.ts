import { describe, expect, it } from 'vitest';
import { STATUS_NAME_MAX, hasSameName, normalizeStatusName, statusNameError } from './statusName';

describe('normalizeStatusName', () => {
	it('убирает пробелы по краям, внутренние не трогает', () => {
		expect(normalizeStatusName('  Встреча с вузом  ')).toBe('Встреча с вузом');
		expect(normalizeStatusName('Подписание  документов')).toBe('Подписание  документов');
		expect(normalizeStatusName(null)).toBe('');
	});
});

describe('statusNameError', () => {
	it('пустое и из одних пробелов — ошибка', () => {
		expect(statusNameError('')).toBe('Введите название');
		expect(statusNameError('   ')).toBe('Введите название');
	});
	it('255 символов можно, 256 — нет (после обрезки пробелов)', () => {
		expect(statusNameError('а'.repeat(STATUS_NAME_MAX))).toBeNull();
		expect(statusNameError(` ${'а'.repeat(STATUS_NAME_MAX)} `)).toBeNull();
		expect(statusNameError('а'.repeat(STATUS_NAME_MAX + 1))).toMatch(/255/);
	});
	it('обычное название — без ошибки', () => expect(statusNameError('Подписание документов')).toBeNull());
});

describe('hasSameName', () => {
	const list = [
		{ key: 'a', name: 'Подписание документов' },
		{ key: 'b', name: 'Обучение преподавателей' },
		{ key: 'c', name: 'Старый шаг', is_archived: true }
	];
	it('без учёта регистра и пробелов по краям', () => {
		expect(hasSameName(list, 'b', ' подписание ДОКУМЕНТОВ ')).toBe(true);
	});
	it('собственное имя шага не считается совпадением', () => {
		expect(hasSameName(list, 'a', 'Подписание документов')).toBe(false);
	});
	it('архивные шаги и пустое имя не мешают', () => {
		expect(hasSameName(list, 'a', 'Старый шаг')).toBe(false);
		expect(hasSameName(list, 'a', '   ')).toBe(false);
	});
});
