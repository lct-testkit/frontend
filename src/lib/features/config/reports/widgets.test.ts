import { describe, expect, it } from 'vitest';
import { CHART_PRESETS, canChart, chartRows, columnSum, readConfig, runKey, tileValue, toNumber } from './widgets';
import type { XlsxTable } from './xlsx';

const funnel: XlsxTable = {
	columns: ['Статус', 'Сейчас в статусе', 'Всего прошло', 'Конверсия шага, %', 'Среднее время, дн.'],
	rows: [
		['Новая', 5, 12, 100, 1.5],
		['В работе', 3, 8, 66.7, null],
		['', 1, 1, null, null]
	],
	sheetName: 'Воронка',
	truncated: false
};

describe('виджеты дашборда', () => {
	it('читает конфиг и отбрасывает мусор', () => {
		expect(readConfig({ template_code: 'deal_funnel', params: { deal_type: 'b2b' }, metric: 'rows' })).toEqual({ template_code: 'deal_funnel', params: { deal_type: 'b2b' }, title: undefined, metric: 'rows' });
		expect(readConfig({})).toBeNull();
		expect(readConfig(null)).toBeNull();
	});

	it('число из ячейки: числа, «12,5», пусто', () => {
		expect(toNumber(7)).toBe(7);
		expect(toNumber('12,5')).toBe(12.5);
		expect(toNumber('1 250')).toBe(1250);
		expect(toNumber('')).toBeNull();
		expect(toNumber(null)).toBeNull();
	});

	it('сумма по колонке и показатель', () => {
		expect(columnSum(funnel, 'Сейчас в статусе')).toBe(9);
		expect(columnSum(funnel, 'нет такой')).toBeNull();
		expect(tileValue(funnel, 'rows')).toBe(3);
		expect(tileValue(funnel, 'sum:Всего прошло')).toBe(21);
		expect(tileValue(funnel, 'что-то')).toBeNull();
	});

	it('строки графика: категории без названия пропускаются', () => {
		const rows = chartRows(funnel, CHART_PRESETS.deal_funnel);
		expect(rows).toEqual([
			{ name: 'Новая', 'Сейчас в статусе': 5 },
			{ name: 'В работе', 'Сейчас в статусе': 3 }
		]);
		expect(chartRows({ ...funnel, columns: ['A', 'B'] }, CHART_PRESETS.deal_funnel)).toEqual([]);
	});

	it('какие отчёты рисуются графиком и ключ запуска не зависит от порядка параметров', () => {
		expect(canChart('monthly_dynamics')).toBe(true);
		expect(canChart('stuck_deals')).toBe(false);
		expect(runKey({ template_code: 'x', params: { b: 1, a: 2 } })).toBe(runKey({ template_code: 'x', params: { a: 2, b: 1 } }));
	});
});
