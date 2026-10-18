// Мастер передачи дел: распределение сделок и вузов уходящего сотрудника по преемникам. Чистая логика без запросов (тесты рядом).
//
// Сделки приходят из `GET /api/admin/users/{id}/offboard/items?kind=deals` (id, номер, название, название вуза), вузы — `kind=organizations`.
// Выбор делается на трёх уровнях: «как у всех» (преемник по умолчанию) → вуз целиком → отдельная сделка. В тело запроса уходят только отличия
// от преемника по умолчанию (`deal_successors`, `organization_successors`), чтобы тело не раздувалось.

export interface DealItem {
	id: string;
	number?: string | null;
	title?: string | null;
	organization_name?: string | null;
	closed?: boolean;
}

export interface OrgItem {
	id: string;
	title?: string | null;
}

/** Ключ группы сделок без вуза (физические лица). */
export const NO_ORG = '__no_org__';
export const NO_ORG_LABEL = 'Физические лица';

export interface DealGroup {
	key: string;
	name: string;
	deals: DealItem[];
}

/** Сделки по вузам (по названию: в списке уходящего нет id вуза); без вуза — одна группа «Физические лица» в конце. */
export function groupByOrganization(deals: readonly DealItem[]): DealGroup[] {
	const map = new Map<string, DealGroup>();
	for (const d of deals) {
		const name = d.organization_name?.trim();
		const key = name || NO_ORG;
		const group = map.get(key) ?? { key, name: name || NO_ORG_LABEL, deals: [] };
		group.deals.push(d);
		map.set(key, group);
	}
	const groups = [...map.values()].sort((a, b) => (a.key === NO_ORG ? 1 : b.key === NO_ORG ? -1 : a.name.localeCompare(b.name, 'ru')));
	return groups;
}

/** Выбор распределения: `null`/нет записи — «как у всех». */
export interface AllocationChoice {
	/** вуз (ключ группы) → преемник для всех его сделок */
	groups: Record<string, string | null>;
	/** отдельная сделка → преемник (сильнее выбора по вузу) */
	deals: Record<string, string | null>;
	/** вуз сотрудника (id вуза) → новый ответственный за вуз */
	orgs: Record<string, string | null>;
}

export const emptyChoice = (): AllocationChoice => ({ groups: {}, deals: {}, orgs: {} });

/** Преемник сделки с учётом выбора: сделка → вуз → по умолчанию. */
export function effectiveSuccessor(deal: DealItem, choice: AllocationChoice, defaultId: string): string {
	const own = choice.deals[deal.id];
	if (own) return own;
	const group = choice.groups[deal.organization_name?.trim() || NO_ORG];
	return group || defaultId;
}

/** `deal_successors` запроса: только сделки, чей преемник отличается от преемника по умолчанию. */
export function buildDealSuccessors(deals: readonly DealItem[], choice: AllocationChoice, defaultId: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const d of deals) {
		const who = effectiveSuccessor(d, choice, defaultId);
		if (who !== defaultId) out[d.id] = who;
	}
	return out;
}

/** `organization_successors` запроса: только вузы, у которых ответственный отличается от преемника по умолчанию. */
export function buildOrganizationSuccessors(orgs: readonly OrgItem[], choice: AllocationChoice, defaultId: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const o of orgs) {
		const who = choice.orgs[o.id];
		if (who && who !== defaultId) out[o.id] = who;
	}
	return out;
}

/**
 * «Разложить поровну»: группы вузов целиком по кандидатам; очередная группа уходит тому, у кого сейчас меньше сделок (при равенстве — первому по списку).
 * Порядок групп не меняется, группа не дробится.
 */
export function roundRobin(groups: readonly DealGroup[], candidates: readonly string[]): Record<string, string> {
	const out: Record<string, string> = {};
	if (!candidates.length) return out;
	const load = new Map(candidates.map((c) => [c, 0]));
	for (const g of groups) {
		let best = candidates[0];
		for (const c of candidates) if ((load.get(c) ?? 0) < (load.get(best) ?? 0)) best = c;
		out[g.key] = best;
		load.set(best, (load.get(best) ?? 0) + g.deals.length);
	}
	return out;
}

export interface SuccessorSummary {
	successorId: string;
	deals: number;
	/** названия вузов, сделки которых целиком или частично уходят этому преемнику (для строки сводки) */
	groups: string[];
	organizations: number;
}

/** Сводка для подтверждения: сколько сделок и вузов получит каждый преемник; преемник по умолчанию идёт первым, остальные — по числу сделок. */
export function summarizeAllocation(deals: readonly DealItem[], orgs: readonly OrgItem[], choice: AllocationChoice, defaultId: string): SuccessorSummary[] {
	const map = new Map<string, { deals: number; groups: Set<string>; organizations: number }>();
	const slot = (id: string) => map.get(id) ?? map.set(id, { deals: 0, groups: new Set(), organizations: 0 }).get(id)!;
	slot(defaultId);
	for (const d of deals) {
		const s = slot(effectiveSuccessor(d, choice, defaultId));
		s.deals += 1;
		s.groups.add(d.organization_name?.trim() || NO_ORG_LABEL);
	}
	for (const o of orgs) slot(choice.orgs[o.id] || defaultId).organizations += 1;
	return [...map.entries()]
		.map(([successorId, v]) => ({ successorId, deals: v.deals, groups: [...v.groups], organizations: v.organizations }))
		.sort((a, b) => (a.successorId === defaultId ? -1 : b.successorId === defaultId ? 1 : b.deals - a.deals));
}

/** После «Обновить список»: выбор сохраняется по id, исчезнувшие сделки и вузы из него убираются; группы, которых больше нет, тоже. */
export function pruneChoice(choice: AllocationChoice, deals: readonly DealItem[], orgs: readonly OrgItem[]): AllocationChoice {
	const dealIds = new Set(deals.map((d) => d.id));
	const orgIds = new Set(orgs.map((o) => o.id));
	const groupKeys = new Set(groupByOrganization(deals).map((g) => g.key));
	const pick = <T>(src: Record<string, T>, keep: Set<string>) => Object.fromEntries(Object.entries(src).filter(([k]) => keep.has(k)));
	return { groups: pick(choice.groups, groupKeys), deals: pick(choice.deals, dealIds), orgs: pick(choice.orgs, orgIds) };
}

/** Id сделки из ошибки 422 `errors[field=deal_successors, reason=<id>]` («сделка не принадлежит увольняемому»). */
export function staleDealIds(errors: readonly { field: string; reason: string }[]): string[] {
	const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
	return errors.filter((e) => e.field.includes('deal_successors')).flatMap((e) => [...(uuid.exec(e.reason) ?? uuid.exec(e.field) ?? [])].slice(0, 1));
}
