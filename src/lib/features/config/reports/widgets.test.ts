import { describe, expect, it } from 'vitest';
import { CHART_PRESETS, canChart, chartRows, columnSum, effectiveParams, readConfig, runKey, tileValue, toNumber } from './widgets';
import { fromReportData, type ReportTable } from './table';

const funnel: ReportTable = fromReportData({
	columns: ['Статус', 'Сейчас в статусе', 'Всего прошло', 'Конверсия шага, %', 'Среднее время, дн.'],
	rows: [
		['Новая', 5, 12, 100, 1.5],
		['В работе', 3, 8, 66.7, null],
		['', 1, 1, null, null]
	]
});

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

	it('показатель и сумма читают totalRows и sums, а не усечённые rows', () => {
		const cut: ReportTable = { columns: ['Вуз', 'Сумма'], rows: [['а', 1]], totalRows: 842, sums: { Сумма: 5000 } };
		expect(tileValue(cut, 'rows')).toBe(842);
		expect(tileValue(cut, 'sum:сумма')).toBe(5000);
		expect(columnSum({ columns: ['Вуз'], rows: [['а']], totalRows: 1, sums: {} }, 'Вуз')).toBe(0);
	});

	it('строки графика: категории без названия пропускаются', () => {
		const rows = chartRows(funnel, CHART_PRESETS.deal_funnel);
		expect(rows).toEqual([
			{ name: 'Новая', 'Сейчас в статусе': 5 },
			{ name: 'В работе', 'Сейчас в статусе': 3 }
		]);
		expect(chartRows({ ...funnel, columns: ['A', 'B'] }, CHART_PRESETS.deal_funnel)).toEqual([]);
	});

	it('рейтинг востребованности: три серии, категория — продукт или направление', () => {
		const cols = ['Место', 'X', 'Заявок', 'Выиграно', 'Обучающихся', 'Потоков', 'Индекс, %'];
		const byProduct = fromReportData({ columns: cols.map((c) => (c === 'X' ? 'Продукт' : c)), rows: [[1, 'Python', 13, 0, 49, 2, 29.1]] });
		const byDirection = fromReportData({ columns: cols.map((c) => (c === 'X' ? 'Направление' : c)), rows: [[1, 'Разработка ПО', 28, 1, 85, 0, 56]] });
		const expected = (name: string, a: number, l: number, s: number) => [{ name, Заявок: a, Обучающихся: l, Потоков: s }];
		expect(chartRows(byProduct, CHART_PRESETS.product_demand)).toEqual(expected('Python', 13, 49, 2));
		expect(chartRows(byDirection, CHART_PRESETS.product_demand)).toEqual(expected('Разработка ПО', 28, 85, 0));
		expect(CHART_PRESETS.product_demand.series).toHaveLength(3);
		expect(canChart('learning_progress')).toBe(false);
		expect(canChart('license_register')).toBe(false);
	});

	it('какие отчёты рисуются графиком и ключ запуска не зависит от порядка параметров', () => {
		expect(canChart('monthly_dynamics')).toBe(true);
		expect(canChart('stuck_deals')).toBe(false);
		expect(runKey({ template_code: 'x', params: { b: 1, a: 2 } })).toBe(runKey({ template_code: 'x', params: { a: 2, b: 1 } }));
	});

	it('быстрый период: даты пересчитываются на сегодня, ключ запуска меняется на следующий день', () => {
		const config = { template_code: 'deal_register', params: { date_from: '2020-01-01', date_to: '2020-01-31', organization_ids: ['b', 'a'] }, period: 'this_month' as const };
		const today = new Date(2026, 9, 16);
		expect(effectiveParams(config, today)).toMatchObject({ date_from: '2026-10-01', date_to: '2026-10-16' });
		expect(runKey(config, today)).not.toBe(runKey(config, new Date(2026, 9, 17)));
		const reordered = { ...config, params: { ...config.params, organization_ids: ['a', 'b'] } };
		expect(runKey(reordered, today)).toBe(runKey(config, today));
	});

	it('виджет без period и пресет «всё время» работают как раньше', () => {
		const plain = { template_code: 'x', params: { date_from: '2026-01-01' } };
		expect(effectiveParams(plain, new Date(2026, 9, 16))).toEqual({ date_from: '2026-01-01' });
		expect(effectiveParams({ params: { date_from: '2026-01-01' }, period: 'all' }, new Date(2026, 9, 16))).toEqual({});
		expect(readConfig({ template_code: 'x', period: 'this_year' })?.period).toBe('this_year');
		expect(readConfig({ template_code: 'x', period: 'сегодня' })?.period).toBeUndefined();
	});
});
