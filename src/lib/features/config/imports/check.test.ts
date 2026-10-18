import { describe, expect, it } from 'vitest';
import { duplicateHeaders, duplicateHeadersText, exampleRows, outcomeLines, rowLabel, rowRemarks } from './check';

const NBSP = ' ';

describe('outcomeLines', () => {
	it('проверка: «Будет создано» и «Будет обновлено», нули скрыты', () => {
		const lines = outcomeLines({ create: { license: 3 }, update: { license: 0 }, skip: { license: 0 } }, 'would');
		expect(lines).toEqual([{ key: 'create', label: 'Будет создано', text: `3${NBSP}лицензии` }]);
	});
	it('после применения: «Создано / Обновлено / Пропущено», несколько сущностей через запятую', () => {
		const lines = outcomeLines({ create: { license: 1, vendor: 2 }, update: { license: 3 } }, 'applied');
		expect(lines.map((l) => l.label)).toEqual(['Создано', 'Обновлено']);
		expect(lines[0].text).toBe(`1${NBSP}лицензию, 2${NBSP}вендоров`);
	});
	it('неизвестная сущность показывается как есть; пусто — пустой список', () => {
		expect(outcomeLines({ create: { gizmo: 4 } }, 'would')[0].text).toBe('4 (gizmo)');
		expect(outcomeLines({}, 'would')).toEqual([]);
		expect(outcomeLines(null, 'applied')).toEqual([]);
	});
});

describe('exampleRows', () => {
	it('одна и несколько строк, остаток', () => {
		expect(exampleRows([7], 1)).toBe('строка 7');
		expect(exampleRows([4, 5, 6, 7])).toBe('строки 4, 5, 6, 7');
		expect(exampleRows([4, 5, 6, 7, 8, 9], 40)).toBe('строки 4, 5, 6, 7, 8 и ещё 35');
		expect(exampleRows([])).toBe('');
	});
});

describe('duplicateHeaders', () => {
	it('находит повторы, пустые заголовки не считает', () => {
		expect(duplicateHeaders(['Вендор', 'ПО', 'Вендор', '', ''])).toEqual(['Вендор']);
		expect(duplicateHeaders(['А', 'Б'])).toEqual([]);
		expect(duplicateHeaders(undefined)).toEqual([]);
	});
});

describe('duplicateHeadersText', () => {
	it('называет колонки и говорит, что делать; пусто — null', () => {
		expect(duplicateHeadersText(['Вендор'])).toContain('«Вендор»');
		expect(duplicateHeadersText(['Вендор', 'ПО'])).toContain('«Вендор», «ПО»');
		expect(duplicateHeadersText([])).toBeNull();
		expect(duplicateHeadersText(undefined)).toBeNull();
	});
});

describe('rowRemarks', () => {
	it('структурные замечания сервера: сообщение, подсказка, серьёзность, ссылка для «вуз не найден»', () => {
		const list = rowRemarks({
			errors: ['старый текст'],
			issues: [
				{ code: 'org_not_found', field: 'organization_name', message: '«Название ВУЗа»: значение X не найдено', hint: 'Проверьте название', severity: 'error' },
				{ code: 'other', field: null, message: 'понято как год', hint: null, severity: 'warning' }
			]
		});
		expect(list).toHaveLength(2);
		expect(list[0]).toMatchObject({ text: '«Название ВУЗа»: значение X не найдено', fix: 'Проверьте название', severity: 'error', link: { href: '/organizations' } });
		expect(list[1]).toMatchObject({ text: 'понято как год', severity: 'warning', fix: undefined, link: undefined });
	});
	it('старая строка без issues: разбор текста, неизвестный текст как есть', () => {
		const list = rowRemarks({ errors: ['Запись для обновления не найдена', 'что-то новое'] });
		expect(list[0].fix).toBeTruthy();
		expect(list[1]).toMatchObject({ text: 'что-то новое', severity: 'error' });
		expect(rowRemarks({ errors: [] })).toEqual([]);
	});
});

describe('rowLabel', () => {
	it('строка файла как в Excel, с листом только для нескольких листов', () => {
		expect(rowLabel({ row_number: 1, source_row: 4, sheet: 'Данные' }, false)).toBe('4');
		expect(rowLabel({ row_number: 1, source_row: 4, sheet: 'Архив' }, true)).toBe('Архив, 4');
		expect(rowLabel({ row_number: 9 }, true)).toBe('9');
	});
});
