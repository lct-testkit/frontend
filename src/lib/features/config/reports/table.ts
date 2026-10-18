// Таблица отчёта в памяти дашборда: данные `GET /api/reports/{id}/data` плюс то, что нужно виджету, чтобы не хранить все строки
// (число строк и суммы считаются по ВСЕМ строкам ответа до того, как кэш отрежет хвост).
import type { ReportDataOut } from '../types';

export type Cell = string | number | boolean | null;

export interface ReportTable {
	columns: string[];
	/** строки; после чтения из кэша — только первые `CACHE_ROWS` */
	rows: Cell[][];
	/** сколько строк пришло в ответе (не длина `rows` после усечения кэша) */
	totalRows: number;
	/** сумма по каждой колонке, где есть хотя бы одно число */
	sums: Record<string, number>;
	title?: string;
	/** пометка отчёта («Источник: …», пояснение к расчёту) */
	note?: string | null;
	/** когда сервер построил набор (ISO) */
	generatedAt?: string;
	/** сервер сам отрезал строки по «Не больше строк» */
	truncated?: boolean;
	/** сколько строк было по выборке, если сервер усёк */
	serverTotal?: number | null;
}

/** Число из ячейки: отчёты отдают числа, но CSV-подобные значения бывают строками («12,5»). */
export function toNumber(cell: Cell | undefined): number | null {
	if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
	if (typeof cell === 'string') {
		const n = Number(cell.replace(/\s/g, '').replace(',', '.'));
		return cell.trim() !== '' && Number.isFinite(n) ? n : null;
	}
	return null;
}

/** Суммы по всем числовым колонкам; текстовые колонки (нет ни одного числа) в результат не попадают. */
export function columnSums(columns: readonly string[], rows: readonly Cell[][]): Record<string, number> {
	const sums: Record<string, number> = {};
	columns.forEach((name, at) => {
		let sum = 0;
		let any = false;
		for (const row of rows) {
			const n = toNumber(row[at]);
			if (n !== null) {
				sum += n;
				any = true;
			}
		}
		if (any) sums[name] = sum;
	});
	return sums;
}

/** Ответ сервера → таблица виджета. */
export function fromReportData(data: Pick<ReportDataOut, 'columns' | 'rows'> & Partial<ReportDataOut>): ReportTable {
	const rows = data.rows as Cell[][];
	return {
		columns: data.columns,
		rows,
		totalRows: rows.length,
		sums: columnSums(data.columns, rows),
		title: data.title,
		note: data.note ?? null,
		generatedAt: data.generated_at,
		truncated: data.truncated === true,
		serverTotal: data.total_rows ?? null
	};
}
