import { describe, expect, it } from 'vitest';
import { exportFileName, paramsSummary, withAlpha } from './chart-export';

const labels = { organization_ids: 'Вузы', direction_ids: 'Направления', product_ids: 'Продукты', owner_ids: 'Ответственные' };

describe('имя файла выгрузки', () => {
	it('название, дата и расширение; пробелы — подчёркивания', () => {
		expect(exportFileName('Воронка по статусам', new Date(2026, 9, 16), 'png')).toBe('Воронка_по_статусам_2026-10-16.png');
		expect(exportFileName('Сводка', new Date(2026, 0, 5), 'pdf')).toBe('Сводка_2026-01-05.pdf');
		expect(exportFileName('Данные', new Date(2026, 9, 16), 'json')).toBe('Данные_2026-10-16.json');
	});

	it('запрещённые в именах символы заменяются, повторы и края чистятся, пустое название — «Отчёт»', () => {
		const backslash = String.fromCharCode(92);
		expect(exportFileName(`A/B${backslash}C:D*E?F"G<H>I|J`, new Date(2026, 9, 16), "png")).toBe("A_B_C_D_E_F_G_H_I_J_2026-10-16.png");
		expect(exportFileName('  / / ', new Date(2026, 9, 16), 'png')).toBe('Отчёт_2026-10-16.png');
	});
});

describe('сводка параметров для файла', () => {
	it('без параметров — «Все данные»', () => {
		expect(paramsSummary({}, labels)).toBe('Все данные');
		expect(paramsSummary({ organization_ids: [] }, labels)).toBe('Все данные');
	});

	it('период и число выбранных; не выбранные грани — «все»', () => {
		const s = paramsSummary({ date_from: '2026-09-01', date_to: '2026-09-30', organization_ids: ['a', 'b'] }, labels);
		expect(s).toContain('Вузы: 2');
		expect(s).toContain('Направления: все');
		expect(s).toMatch(/Период 01\.09–30\.09\.2026/);
	});

	it('другой год в границах — даты целиком; одна граница — «с» или «по»; фильтры без периода — «Весь период»', () => {
		expect(paramsSummary({ date_from: '2025-12-01', date_to: '2026-01-31' }, {})).toBe('Период 01.12.2025–31.01.2026');
		expect(paramsSummary({ date_from: '2026-09-01' }, {})).toBe('Период с 01.09.2026');
		expect(paramsSummary({ date_to: '2026-09-30' }, {})).toBe('Период по 30.09.2026');
		expect(paramsSummary({ product_ids: 'x,y,z' }, labels)).toMatch(/^Весь период · .*Продукты: 3/);
	});
});

describe('прозрачность цвета', () => {
	it('rgb → rgba с той же тройкой', () => {
		expect(withAlpha('rgb(10, 20, 30)', 0.5)).toBe('rgba(10, 20, 30, 0.5)');
		expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.5)).toBe('rgba(10, 20, 30, 0.5)');
		expect(withAlpha('#fff', 0.5)).toBe('#fff');
	});
});
