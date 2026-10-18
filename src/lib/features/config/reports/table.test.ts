import { describe, expect, it } from 'vitest';
import { columnSums, fromReportData, toNumber } from './table';

describe('fromReportData', () => {
	it('JSON бэкенда в таблицу виджета: число строк и суммы по ВСЕМ строкам', () => {
		const rows = Array.from({ length: 1000 }, (_, i) => [`Вуз ${i}`, i % 2 === 0 ? 'Новая' : 'В работе', 10]);
		const table = fromReportData({ columns: ['Вуз', 'Статус', 'Сумма, ₽'], rows });
		expect(table.totalRows).toBe(1000);
		expect(table.sums).toEqual({ 'Сумма, ₽': 10_000 });
		expect(table.rows).toHaveLength(1000);
	});

	it('текстовая колонка без чисел в суммы не попадает; «12,5» считается как 12.5', () => {
		const table = fromReportData({
			columns: ['Название', 'Доля'],
			rows: [
				['а', '12,5'],
				['б', 2.5]
			]
		});
		expect(table.sums).toEqual({ Доля: 15 });
		expect(columnSums(['Название'], [['а']])).toEqual({});
	});

	it('сохраняет примечание, время построения и признак усечения сервера', () => {
		const table = fromReportData({ columns: ['A'], rows: [[1]], title: 'Заголовок', note: 'Снимок', generated_at: '2026-10-16T11:35:00Z', truncated: true, total_rows: 40 });
		expect(table).toMatchObject({ title: 'Заголовок', note: 'Снимок', generatedAt: '2026-10-16T11:35:00Z', truncated: true, serverTotal: 40 });
		expect(fromReportData({ columns: ['A'], rows: [] })).toMatchObject({ note: null, truncated: false, serverTotal: null, totalRows: 0 });
	});
});

describe('toNumber', () => {
	it('числа, строки с пробелами и запятой, пусто', () => {
		expect(toNumber(7)).toBe(7);
		expect(toNumber('12,5')).toBe(12.5);
		expect(toNumber('1 250')).toBe(1250);
		expect(toNumber('')).toBeNull();
		expect(toNumber(null)).toBeNull();
		expect(toNumber(Number.NaN)).toBeNull();
	});
});
