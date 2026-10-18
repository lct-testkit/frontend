// «Путь вуза»: сделки организации по продуктам и хронология их переходов. Чистая логика без запросов (тесты рядом).
import type { Step } from '$lib/ui';
import type { DealRow } from '../deals/list/dealProducts';
import { optionalStepIds, statusName, stepStates, steps, transitionKind, type TransitionKind } from '../deals/statusUtils';
import type { DealHistory, WorkflowGraph } from '../types';

export interface Lane {
	/** id продукта; `none` — сделки без продуктов */
	key: string;
	name: string;
	deals: DealRow[];
}

export const NO_PRODUCT = 'none';

/**
 * Дорожки по продуктам: сделка с двумя продуктами попадает в обе дорожки, без продуктов — в «Без продукта» (последней).
 * Дорожки — по названию продукта, сделки в них — по номеру. Продуктов у сделки в списке не больше 5 (так отдаёт сервер).
 */
export function groupByProduct(deals: readonly DealRow[]): Lane[] {
	const lanes = new Map<string, Lane>();
	const put = (key: string, name: string, deal: DealRow) => {
		const lane = lanes.get(key) ?? { key, name, deals: [] };
		if (!lane.deals.includes(deal)) lane.deals.push(deal);
		lanes.set(key, lane);
	};
	for (const deal of deals) {
		const products = deal.products ?? [];
		if (!products.length) put(NO_PRODUCT, 'Без продукта', deal);
		for (const p of products) put(p.product_id, p.product_name, deal);
	}
	const sorted = [...lanes.values()].sort((a, b) => (a.key === NO_PRODUCT ? 1 : b.key === NO_PRODUCT ? -1 : a.name.localeCompare(b.name, 'ru')));
	for (const lane of sorted) lane.deals.sort((a, b) => a.number.localeCompare(b.number));
	return sorted;
}

export type EventKind = 'created' | TransitionKind;

export interface JourneyEvent {
	id: string;
	dealId: string;
	number: string;
	title: string;
	at: string;
	fromStatusId: string | null;
	toStatusId: string;
	by: string | null;
	comment: string | null;
	filesCount: number;
	kind: EventKind;
	/** названия необязательных шагов, которые этим переходом обойдены («через шаг») */
	skipped: string[];
}

export interface JourneyInput {
	deal: DealRow;
	history: DealHistory | null;
	graph: WorkflowGraph | undefined;
}

/**
 * Хронология переходов по всем сделкам вуза, новые сверху. Вид перехода: создание, вперёд, через шаг (с названиями обойдённых),
 * назад, возобновление, закрытие / отказ / заморозка. `range` — период по дате перехода (`ГГГГ-ММ-ДД`, включительно).
 */
export function journeyEvents(items: readonly JourneyInput[], range: { from?: string; to?: string } = {}): JourneyEvent[] {
	const events: JourneyEvent[] = [];
	for (const { deal, history, graph } of items) {
		if (!history) continue;
		const list = steps(graph);
		const status = (id: string | null | undefined) => (id ? graph?.statuses.find((s) => s.id === id) : undefined);
		for (const change of history.statuses) {
			const day = change.changed_at.slice(0, 10);
			if ((range.from && day < range.from) || (range.to && day > range.to)) continue;
			const from = status(change.from_status_id);
			const to = status(change.to_status_id);
			const kind: EventKind = change.from_status_id ? transitionKind(to, from, list) : 'created';
			let skipped: string[] = [];
			if (kind === 'skip' && from && to) {
				const a = list.findIndex((s) => s.id === from.id);
				const b = list.findIndex((s) => s.id === to.id);
				skipped = list.slice(a + 1, b).map((s) => statusName(s.name));
			}
			events.push({
				id: change.id,
				dealId: deal.id,
				number: deal.number,
				title: deal.title,
				at: change.changed_at,
				fromStatusId: change.from_status_id ?? null,
				toStatusId: change.to_status_id,
				by: change.changed_by ?? null,
				comment: change.comment ?? null,
				filesCount: change.attachments_count,
				kind,
				skipped
			});
		}
	}
	return events.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Лента шагов сделки (те же состояния, что в карточке сделки). Без истории (запасной путь показывает её не по всем сделкам)
 * пропусков не рисуем: что сделка пропустила, неизвестно.
 */
export function ribbon(graph: WorkflowGraph | undefined, deal: DealRow, history: DealHistory | null): Step[] {
	const list = steps(graph);
	const current = graph?.statuses.find((s) => s.id === deal.status_id);
	const terminal = current && (current.type === 'won' || current.type === 'lost' || current.type === 'parked') ? current : null;
	const visited = new Set<string>();
	for (const s of history?.statuses ?? []) {
		if (s.from_status_id) visited.add(s.from_status_id);
		visited.add(s.to_status_id);
	}
	const migrated = !history || history.events.some((e) => e.event_type === 'WORKFLOW_MIGRATION') || history.statuses.some((s) => s.reason === 'workflow_migration');
	let index = list.findIndex((s) => s.id === deal.status_id);
	if (terminal) {
		if (terminal.type === 'won') index = list.length;
		else {
			const stopped = (history?.statuses ?? [])
				.filter((s) => s.to_status_id === terminal.id)
				.sort((a, b) => a.changed_at.localeCompare(b.changed_at))
				.at(-1)?.from_status_id;
			index = stopped ? list.findIndex((s) => s.id === stopped) : -1;
		}
	}
	const optional = optionalStepIds(graph);
	const states = stepStates(list, index, visited, optional, !!terminal, migrated);
	return list.map((step, i) => ({ id: step.id, name: statusName(step.name), state: states[i], optional: optional.has(step.id) }));
}

/** Сделки с нужным продуктом (`none` — без продуктов) и направлением; пустое значение — любые. */
export function filterDeals(deals: readonly DealRow[], filter: { product?: string; direction?: string }): DealRow[] {
	return deals.filter((d) => {
		if (filter.product) {
			const has = filter.product === NO_PRODUCT ? !(d.products ?? []).length : (d.products ?? []).some((p) => p.product_id === filter.product);
			if (!has) return false;
		}
		if (filter.direction && !(d.directions ?? []).some((x) => x.id === filter.direction)) return false;
		return true;
	});
}
