// План переноса сделок со старых шагов: порядок, в котором статусы уходят в архив. Чистая логика (тесты рядом).
// Цель переноса не должна быть в архиве к моменту вызова: если A → B и B → C, сначала архивируется A (B ещё жив), потом B.

export interface MigrationRow {
	/** id архивируемого статуса */
	from: string;
	/** id статуса, куда переносятся сделки */
	to: string;
	/** начальный статус не архивируется */
	initial?: boolean;
}

export type PlanResult = { ok: true; order: MigrationRow[] } | { ok: false; error: string };

/**
 * Порядок архивации строк таблицы переноса. Отказ: начальный статус в списке, статус переносится сам в себя, цикл (A → B → A),
 * один статус в двух строках. Одинаковые цели у нескольких статусов допустимы.
 */
export function planOrder(rows: readonly MigrationRow[]): PlanResult {
	const seen = new Set<string>();
	for (const row of rows) {
		if (row.initial) return { ok: false, error: 'Начальный статус не архивируется — переименуйте его в шаг 1' };
		if (row.from === row.to) return { ok: false, error: 'Статус нельзя перенести в него же' };
		if (seen.has(row.from)) return { ok: false, error: 'Один и тот же статус указан в двух строках' };
		seen.add(row.from);
	}
	// цель, которая сама архивируется, должна идти позже: строка `r` зависит от строки с `from === r.to`
	const order: MigrationRow[] = [];
	const state = new Map<string, 'visiting' | 'done'>();
	const visit = (row: MigrationRow): boolean => {
		const s = state.get(row.from);
		if (s === 'done') return true;
		if (s === 'visiting') return false;
		state.set(row.from, 'visiting');
		// строки, которые переносят сделки В этот статус, идут раньше него: пока он не в архиве
		for (const other of rows) if (other.to === row.from && other.from !== row.from && !visit(other)) return false;
		state.set(row.from, 'done');
		order.push(row);
		return true;
	};
	for (const row of rows) if (!visit(row)) return { ok: false, error: 'Переносы идут по кругу: статус нельзя перенести в тот, что сам уходит в архив позже' };
	return { ok: true, order };
}
