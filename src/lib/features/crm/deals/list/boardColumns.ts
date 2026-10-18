// Столбцы доски: у каждого свой запрос, свой `total` и свой курсор. Чистая логика без запросов (тесты рядом).
import type { DealRow } from './dealProducts';

export const COLUMN_PAGE = 25;

export interface BoardColumn {
	items: DealRow[];
	/** сколько сделок в статусе по данным сервера; `null` — ещё не пришло */
	total: number | null;
	cursor: string | null;
	loading: boolean;
	loadingMore: boolean;
	error: unknown;
}

export const emptyColumn = (): BoardColumn => ({ items: [], total: null, cursor: null, loading: true, loadingMore: false, error: null });

/** Дописать следующую страницу столбца: сделка, что уже есть (по `id`), не дублируется. */
export function mergeItems(existing: readonly DealRow[], incoming: readonly DealRow[]): DealRow[] {
	const seen = new Set(existing.map((d) => d.id));
	return [...existing, ...incoming.filter((d) => !seen.has(d.id))];
}

/** Подпись кнопки «Ещё N»: сколько подгрузится следующим шагом. 0 — кнопка не нужна. */
export function remaining(col: Pick<BoardColumn, 'items' | 'total' | 'cursor'>): number {
	if (!col.cursor) return 0;
	const left = (col.total ?? col.items.length + COLUMN_PAGE) - col.items.length;
	return Math.max(0, Math.min(COLUMN_PAGE, left));
}

/** Карточка переехала из одного столбца в другой: оба счётчика сразу меняются на 1, карточка встаёт первой в целевом. */
export function applyMove(cols: Record<string, BoardColumn>, deal: DealRow, fromId: string, toId: string): Record<string, BoardColumn> {
	if (fromId === toId) return cols;
	const next = { ...cols };
	const from = cols[fromId];
	const to = cols[toId];
	if (from) next[fromId] = { ...from, items: from.items.filter((d) => d.id !== deal.id), total: from.total === null ? null : Math.max(0, from.total - 1) };
	if (to) next[toId] = { ...to, items: mergeItems([deal], to.items), total: to.total === null ? null : to.total + 1 };
	return next;
}

/** Свежие числа с сервера поверх оптимистичных (после ответа перехода). */
export function withTotals(cols: Record<string, BoardColumn>, totals: Record<string, number | undefined>): Record<string, BoardColumn> {
	const next = { ...cols };
	for (const [id, total] of Object.entries(totals)) if (total !== undefined && next[id]) next[id] = { ...next[id], total };
	return next;
}

/** Ограничитель параллелизма: не больше `limit` задач одновременно, порядок запуска сохраняется. */
export async function runLimited<T>(tasks: readonly (() => Promise<T>)[], limit: number): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	let next = 0;
	const worker = async () => {
		while (next < tasks.length) {
			const i = next++;
			results[i] = await tasks[i]();
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
	return results;
}
