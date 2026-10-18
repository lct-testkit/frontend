// Виджеты дашборда: как таблица отчёта (JSON `GET /api/reports/{id}/data`, колонки — договорённость с `reporting/builders.py` бэкенда)
// превращается в график, показатель или мини-таблицу.
import { toList } from './params';
import { isPeriodPreset, periodFor, type PeriodPreset } from './period';
import { toNumber, type Cell, type ReportTable } from './table';

export { toNumber };

export type ChartKind = 'bar' | 'line' | 'donut';

export interface ChartPreset {
	kind: ChartKind;
	/** колонка категорий (ось X / доли); список — запасные названия (у «Рейтинга востребованности» колонка зависит от «Группировать по») */
	x: string | string[];
	/** числовые колонки-серии */
	series: string[];
	horizontal?: boolean;
	/** по каким колонкам можно считать сумму для «показателя» */
	sumColumns: string[];
}

export const CHART_PRESETS: Readonly<Record<string, ChartPreset>> = {
	deal_funnel: { kind: 'bar', x: 'Статус', series: ['Сейчас в статусе'], horizontal: true, sumColumns: ['Сейчас в статусе', 'Всего прошло'] },
	kam_summary: { kind: 'bar', x: 'КАМ', series: ['В работе', 'Выиграно', 'Проиграно'], sumColumns: ['В работе', 'Выиграно', 'Проиграно', 'Сумма выигранных'] },
	region_summary: { kind: 'bar', x: 'Регион', series: ['Сделок'], horizontal: true, sumColumns: ['Сделок', 'Сумма выигранных'] },
	loss_reasons: { kind: 'donut', x: 'Причина', series: ['Сделок'], sumColumns: ['Сделок'] },
	sla_compliance: { kind: 'donut', x: 'Состояние', series: ['Сделок'], sumColumns: ['Сделок'] },
	monthly_dynamics: { kind: 'line', x: 'Месяц', series: ['Создано', 'Выиграно', 'Проиграно'], sumColumns: ['Создано', 'Выиграно', 'Проиграно', 'Сумма выигранных'] },
	product_demand: { kind: 'bar', x: ['Продукт', 'Направление'], series: ['Заявок', 'Обучающихся', 'Потоков'], horizontal: true, sumColumns: ['Заявок', 'Выиграно', 'Обучающихся', 'Потоков'] }
};

export const canChart = (templateCode: string): boolean => templateCode in CHART_PRESETS;
export const sumColumnsOf = (templateCode: string): string[] => CHART_PRESETS[templateCode]?.sumColumns ?? [];

export interface WidgetConfig {
	template_code: string;
	params?: Record<string, unknown>;
	/** свой заголовок; по умолчанию — название отчёта */
	title?: string;
	/** `rows` — число строк; `sum:<колонка>` — сумма по колонке */
	metric?: string;
	/** быстрый период: даты считаются при каждом запуске, а не хранятся (плитка «Этот месяц» не устаревает) */
	period?: PeriodPreset;
}

export function readConfig(raw: unknown): WidgetConfig | null {
	if (!raw || typeof raw !== 'object') return null;
	const c = raw as Record<string, unknown>;
	if (typeof c.template_code !== 'string' || !c.template_code) return null;
	return {
		template_code: c.template_code,
		params: c.params && typeof c.params === 'object' ? (c.params as Record<string, unknown>) : {},
		title: typeof c.title === 'string' ? c.title : undefined,
		metric: typeof c.metric === 'string' ? c.metric : undefined,
		period: isPeriodPreset(c.period) ? c.period : undefined
	};
}

const indexOfColumn = (table: ReportTable, name: string): number => table.columns.findIndex((c) => c.trim().toLowerCase() === name.trim().toLowerCase());

export function columnSum(table: ReportTable, column: string): number | null {
	const at = indexOfColumn(table, column);
	if (at < 0) return null;
	// суммы посчитаны по всем строкам ответа ещё до того, как кэш отрезал хвост
	const wanted = column.trim().toLowerCase();
	const known = Object.entries(table.sums ?? {}).find(([name]) => name.trim().toLowerCase() === wanted);
	if (known) return known[1];
	let sum = 0;
	let any = false;
	for (const row of table.rows) {
		const n = toNumber(row[at]);
		if (n !== null) {
			sum += n;
			any = true;
		}
	}
	return any ? sum : 0;
}

/** Значение плитки: число строк или сумма по колонке. */
export function tileValue(table: ReportTable, metric: string | undefined): number | null {
	if (!metric || metric === 'rows') return table.totalRows ?? table.rows.length;
	if (metric.startsWith('sum:')) return columnSum(table, metric.slice(4));
	return null;
}

export const metricLabel = (metric: string | undefined): string => (!metric || metric === 'rows' ? 'Строк в отчёте' : metric.startsWith('sum:') ? metric.slice(4) : metric);

export interface ChartRow {
	name: string;
	[series: string]: string | number | null;
}

/** Строки таблицы → объекты `{ name, <серия>: число }` для графиков rt-ui. Строки без категории пропускаются. */
export function chartRows(table: ReportTable, preset: ChartPreset): ChartRow[] {
	const x = [preset.x].flat().reduce((found, name) => (found >= 0 ? found : indexOfColumn(table, name)), -1);
	if (x < 0) return [];
	const cols = preset.series.map((s) => ({ name: s, at: indexOfColumn(table, s) })).filter((c) => c.at >= 0);
	return table.rows
		.filter((row) => row[x] !== null && row[x] !== '')
		.map((row) => {
			const out: ChartRow = { name: String(row[x]) };
			for (const c of cols) out[c.name] = toNumber(row[c.at]);
			return out;
		});
}

/** Первые строки для мини-таблицы виджета. */
export function previewRows(table: ReportTable, limit = 8): { columns: string[]; rows: Cell[][] } {
	return { columns: table.columns, rows: table.rows.slice(0, limit) };
}

/** Параметры запуска: даты быстрого периода пересчитываются на сегодня, остальное — как сохранено. */
export function effectiveParams(config: Pick<WidgetConfig, 'params' | 'period'>, today: Date = new Date()): Record<string, unknown> {
	const params = { ...(config.params ?? {}) };
	if (!config.period) return params;
	delete params.date_from;
	delete params.date_to;
	return { ...params, ...(periodFor(config.period, today) ?? {}) };
}

/** Значение параметра в канонической форме: списки (в том числе «a,b» из старых виджетов) — отсортированные массивы. */
const canonical = (key: string, value: unknown): unknown => (key === 'columns' ? value : Array.isArray(value) || key.endsWith('_ids') || key === 'vendors' || key === 'transfer_statuses' ? toList(value).sort() : value);

/** Одинаковые отчёты разных виджетов запускаются один раз; порядок вузов в списке на ключ не влияет. */
export const runKey = (config: Pick<WidgetConfig, 'template_code' | 'params' | 'period'>, today: Date = new Date()): string =>
	`${config.template_code}|${JSON.stringify(
		Object.entries(effectiveParams(config, today))
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => [k, canonical(k, v)])
	)}`;
