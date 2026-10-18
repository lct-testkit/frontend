// Выбор колонок отчёта: чистые функции над массивом ключей (порядок массива = порядок колонок в файле).
import type { ReportParamOption } from './params';

/** Набор по умолчанию в порядке каталога. */
export const defaultColumns = (options: readonly ReportParamOption[]): string[] => options.filter((o) => o.default).map((o) => o.key);

/** Выбранные ключи, оставшиеся в каталоге (колонку могли убрать на сервере), без повторов. */
export function cleanSelection(selected: readonly string[], options: readonly ReportParamOption[]): string[] {
	const known = new Set(options.map((o) => o.key));
	return [...new Set(selected)].filter((k) => known.has(k));
}

/** Сдвигает выбранную колонку на одну позицию; на краю и для невыбранной ничего не меняет. */
export function moveColumn(selected: readonly string[], key: string, dir: -1 | 1): string[] {
	const at = selected.indexOf(key);
	const to = at + dir;
	if (at < 0 || to < 0 || to >= selected.length) return [...selected];
	const next = [...selected];
	[next[at], next[to]] = [next[to], next[at]];
	return next;
}

/** Включает или выключает колонку: новая встаёт в конец; больше `max` не набрать. */
export function toggleColumn(selected: readonly string[], key: string, on: boolean, max?: number): string[] {
	if (!on) return selected.filter((k) => k !== key);
	if (selected.includes(key) || (max !== undefined && selected.length >= max)) return [...selected];
	return [...selected, key];
}

/** Колонки «как в ТЗ»: только те ключи, которые есть у шаблона, в порядке ТЗ. */
export function columnsAsInSpec(tz: readonly string[], options: readonly ReportParamOption[]): string[] {
	const known = new Set(options.map((o) => o.key));
	return tz.filter((k) => known.has(k));
}

/** Все колонки каталога (с ограничением `max`). */
export function allColumns(options: readonly ReportParamOption[], max?: number): string[] {
	const keys = options.map((o) => o.key);
	return max === undefined ? keys : keys.slice(0, max);
}

/** Порядок строк в списке: выбранные по порядку выбора, затем остальные по каталогу. */
export function listOrder(selected: readonly string[], options: readonly ReportParamOption[]): ReportParamOption[] {
	const byKey = new Map(options.map((o) => [o.key, o]));
	const chosen = selected.flatMap((k) => {
		const option = byKey.get(k);
		return option ? [option] : [];
	});
	return [...chosen, ...options.filter((o) => !selected.includes(o.key))];
}

export const sameColumns = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((k, i) => k === b[i]);
