// Виджеты дашборда: как таблица xlsx (см. builders.py бэкенда) превращается в график, показатель или мини-таблицу.
// Бэкенд отдаёт отчёты только файлами, поэтому колонки — это договорённость с `reporting/builders.py`.
import type { Cell, XlsxTable } from './xlsx';

export type ChartKind = 'bar' | 'line' | 'donut';

export interface ChartPreset {
	kind: ChartKind;
	/** колонка категорий (ось X / доли) */
	x: string;
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
	monthly_dynamics: { kind: 'line', x: 'Месяц', series: ['Создано', 'Выиграно', 'Проиграно'], sumColumns: ['Создано', 'Выиграно', 'Проиграно', 'Сумма выигранных'] }
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
}

export function readConfig(raw: unknown): WidgetConfig | null {
	if (!raw || typeof raw !== 'object') return null;
	const c = raw as Record<string, unknown>;
	if (typeof c.template_code !== 'string' || !c.template_code) return null;
	return {
		template_code: c.template_code,
		params: c.params && typeof c.params === 'object' ? (c.params as Record<string, unknown>) : {},
		title: typeof c.title === 'string' ? c.title : undefined,
		metric: typeof c.metric === 'string' ? c.metric : undefined
	};
}

/** Число из ячейки: xlsx отдаёт числа, но CSV-подобные значения бывают строками («12,5»). */
export function toNumber(cell: Cell | undefined): number | null {
	if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
	if (typeof cell === 'string') {
		const n = Number(cell.replace(/\s/g, '').replace(',', '.'));
		return cell.trim() !== '' && Number.isFinite(n) ? n : null;
	}
	return null;
}

const indexOfColumn = (table: XlsxTable, name: string): number => table.columns.findIndex((c) => c.trim().toLowerCase() === name.trim().toLowerCase());

export function columnSum(table: XlsxTable, column: string): number | null {
	const at = indexOfColumn(table, column);
	if (at < 0) return null;
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
export function tileValue(table: XlsxTable, metric: string | undefined): number | null {
	if (!metric || metric === 'rows') return table.rows.length;
	if (metric.startsWith('sum:')) return columnSum(table, metric.slice(4));
	return null;
}

export const metricLabel = (metric: string | undefined): string => (!metric || metric === 'rows' ? 'Строк в отчёте' : metric.startsWith('sum:') ? metric.slice(4) : metric);

export interface ChartRow {
	name: string;
	[series: string]: string | number | null;
}

/** Строки таблицы → объекты `{ name, <серия>: число }` для графиков rt-ui. Строки без категории пропускаются. */
export function chartRows(table: XlsxTable, preset: ChartPreset): ChartRow[] {
	const x = indexOfColumn(table, preset.x);
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
export function previewRows(table: XlsxTable, limit = 8): { columns: string[]; rows: Cell[][] } {
	return { columns: table.columns, rows: table.rows.slice(0, limit) };
}

/** Одинаковые отчёты разных виджетов запускаются один раз. */
export const runKey = (config: Pick<WidgetConfig, 'template_code' | 'params'>): string =>
	`${config.template_code}|${JSON.stringify(Object.entries(config.params ?? {}).sort(([a], [b]) => a.localeCompare(b)))}`;
