// Числа на вкладках списка сделок («Срок нарушен (7)»). Каждая вкладка — запрос `GET /api/deals?limit=1&…`: нужен только `total`.
// Запросы строятся из текущих фильтров (вуз, направление, статусы…) без быстрого фильтра, поэтому числа меняются вместе с фильтрами.
import { api } from '$lib/api';
import type { DealQuery } from './dealFilters';

export type TabKey = 'all' | 'mine' | 'warning' | 'breached' | 'closed';

export type TabCounts = Partial<Record<TabKey, number>>;

/** Запросы пяти вкладок. Без `meId` вкладка «Мои» не запрашивается (число неизвестно). */
export function tabQueries(base: DealQuery, meId: string | null | undefined): Partial<Record<TabKey, DealQuery>> {
	const { sort: _sort, sla_state: _sla, is_closed: _closed, ...common } = base;
	void _sort;
	void _sla;
	void _closed;
	const out: Partial<Record<TabKey, DealQuery>> = {
		all: common,
		warning: { ...common, sla_state: 'warning' },
		breached: { ...common, sla_state: 'breached' },
		closed: { ...common, is_closed: true }
	};
	// как в таблице: «Мои» уважает вручную выбранного ответственного
	if (meId) out.mine = { ...common, owner_id: common.owner_id ?? [meId] };
	return out;
}

/** Пять параллельных запросов; ошибка одного даёт `undefined` только для его вкладки. */
export async function loadTabCounts(queries: Partial<Record<TabKey, DealQuery>>, signal?: AbortSignal): Promise<TabCounts> {
	const entries = await Promise.all(
		(Object.entries(queries) as [TabKey, DealQuery][]).map(async ([key, query]) => {
			try {
				const { data } = await api.GET('/api/deals', { params: { query: { ...query, limit: 1 } }, signal });
				return [key, typeof data?.total === 'number' ? data.total : undefined] as const;
			} catch {
				return [key, undefined] as const;
			}
		})
	);
	return Object.fromEntries(entries.filter(([, n]) => n !== undefined)) as TabCounts;
}

/** 9 999 → «9999», 10 000 → «10k+». `undefined` — число ещё не пришло: вкладка без числа, а не «0». */
export function formatTabCount(n: number | undefined): string | undefined {
	if (n === undefined) return undefined;
	return n > 9999 ? '10k+' : String(n);
}

/** Сделок в каждой воронке (`workflow_id`, `limit=1`, нужен только `total`); воронка с ошибкой запроса в ответ не попадает. */
export async function loadFlowCounts(workflowIds: string[], signal?: AbortSignal): Promise<Record<string, number>> {
	const entries = await Promise.all(
		workflowIds.map(async (id) => {
			try {
				const { data } = await api.GET('/api/deals', { params: { query: { workflow_id: id, limit: 1 } }, signal });
				return [id, typeof data?.total === 'number' ? data.total : undefined] as const;
			} catch {
				return [id, undefined] as const;
			}
		})
	);
	return Object.fromEntries(entries.filter(([, n]) => n !== undefined)) as Record<string, number>;
}
