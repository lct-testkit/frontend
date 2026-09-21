// Клиентская валидация графа воронки — зеркало `_validate_graph_data` (workflow/service.py),
// плюс разбор строк серверного `POST /validate` в подсветку узлов и рёбер.

import { validateActions, validateCondition } from './dsl-validate';
import { CODE_PATTERN, TERMINAL_TYPES, type GraphDraft, type GraphIssue, type StatusDraft, type TransitionDraft } from './graph';
import { isEmptyCondition, isGroup, isLeaf, groupBranches } from './dsl';

export interface GraphValidationContext {
	knownCustomFields?: ReadonlySet<string>;
}

const issue = (severity: GraphIssue['severity'], code: string, message: string, statusKeys: string[] = [], transitionKeys: string[] = []): GraphIssue => ({
	severity,
	code,
	message,
	statusKeys,
	transitionKeys,
	source: 'client'
});

function hasFieldCondition(node: unknown, field: string): boolean {
	if (isLeaf(node)) return node.field === field;
	if (isGroup(node)) return groupBranches(node).branches.some((b) => hasFieldCondition(b, field));
	return false;
}

function reach(starts: Iterable<string>, adjacency: Map<string, string[]>): Set<string> {
	const seen = new Set<string>(starts);
	const stack = [...seen];
	while (stack.length) {
		const current = stack.pop() as string;
		for (const next of adjacency.get(current) ?? []) {
			if (!seen.has(next)) {
				seen.add(next);
				stack.push(next);
			}
		}
	}
	return seen;
}

const label = (t: TransitionDraft): string => t.name?.trim() || 'без названия';

export function validateGraph(draft: GraphDraft, ctx: GraphValidationContext = {}): GraphIssue[] {
	const issues: GraphIssue[] = [];
	const live = draft.statuses.filter((s) => !s.is_archived);
	const liveKeys = new Set(live.map((s) => s.key));
	const byKey = new Map(live.map((s) => [s.key, s] as const));
	const liveTransitions = draft.transitions.filter((t) => liveKeys.has(t.from) && liveKeys.has(t.to));

	// --- статусы
	const codes = new Map<string, StatusDraft[]>();
	for (const s of live) {
		if (!s.name.trim()) issues.push(issue('error', 'empty_name', 'У статуса нет названия', [s.key]));
		if (!CODE_PATTERN.test(s.code)) {
			issues.push(issue('error', 'bad_code', `Код статуса «${s.code || '—'}» должен быть латиницей: буквы a–z, цифры и «_», начинаться с буквы, 2–64 символа`, [s.key]));
		}
		codes.set(s.code, [...(codes.get(s.code) ?? []), s]);
	}
	for (const [code, group] of codes) {
		if (group.length > 1) issues.push(issue('error', 'duplicate_code', `Код «${code}» используется несколькими статусами`, group.map((s) => s.key)));
	}

	const initials = live.filter((s) => s.type === 'initial');
	if (initials.length !== 1) {
		issues.push(issue('error', 'initial_count', `Должен быть ровно один начальный статус (сейчас ${initials.length})`, initials.map((s) => s.key)));
	}
	const terminals = live.filter((s) => TERMINAL_TYPES.has(s.type));
	if (terminals.length === 0) issues.push(issue('error', 'no_terminal', 'Нужен хотя бы один завершающий статус: успех, отказ или заморозка'));

	// --- переходы
	const allKeys = new Set(draft.statuses.map((s) => s.key));
	const forward = new Map<string, string[]>();
	const backward = new Map<string, string[]>();
	const pairs = new Map<string, TransitionDraft[]>();
	for (const t of draft.transitions) {
		if (!liveKeys.has(t.from) || !liveKeys.has(t.to)) {
			// Переходы в/из архивного статуса — история, сервер их не трогает; ошибка только у ссылки на несуществующий статус.
			if (!allKeys.has(t.from) || !allKeys.has(t.to)) {
				issues.push(issue('error', 'dangling', `Переход «${label(t)}» ссылается на удалённый статус`, [], [t.key]));
			}
			continue;
		}
		if (!t.name.trim()) issues.push(issue('error', 'empty_name', 'У перехода нет названия', [], [t.key]));
		if (t.from === t.to) {
			issues.push(issue('error', 'self_loop', `Переход «${label(t)}» ведёт из статуса в него же`, [t.from], [t.key]));
			continue;
		}
		forward.set(t.from, [...(forward.get(t.from) ?? []), t.to]);
		backward.set(t.to, [...(backward.get(t.to) ?? []), t.from]);
		const pair = `${t.from}→${t.to}`;
		pairs.set(pair, [...(pairs.get(pair) ?? []), t]);
	}
	for (const group of pairs.values()) {
		if (group.length > 1) {
			const from = byKey.get(group[0].from)?.name ?? '?';
			const to = byKey.get(group[0].to)?.name ?? '?';
			issues.push(issue('error', 'duplicate_transition', `Между «${from}» и «${to}» несколько переходов — оставьте один`, [], group.map((t) => t.key)));
		}
	}

	// --- достижимость и ловушки
	if (initials.length === 1) {
		const reachable = reach([initials[0].key], forward);
		for (const s of live) {
			if (!reachable.has(s.key)) issues.push(issue('error', 'unreachable', `Статус «${s.name}» недостижим из начального`, [s.key]));
		}
	}
	if (terminals.length) {
		const canFinish = reach(terminals.map((s) => s.key), backward);
		for (const s of live) {
			if (!canFinish.has(s.key)) issues.push(issue('error', 'trap', `Из статуса «${s.name}» нельзя попасть ни в один завершающий статус`, [s.key]));
		}
	}

	// --- DSL и бизнес-рекомендации
	const liveCodes = new Set(live.map((s) => s.code));
	for (const t of liveTransitions) {
		if (t.from === t.to) continue;
		for (const message of validateCondition(t.conditions, { knownCustomFields: ctx.knownCustomFields, path: 'Условия' })) {
			issues.push(issue('error', 'condition', `Переход «${label(t)}»: ${message}`, [], [t.key]));
		}
		for (const message of validateActions(t.actions, { statusCodes: liveCodes, path: 'Действие' })) {
			issues.push(issue('error', 'action', `Переход «${label(t)}»: ${message}`, [], [t.key]));
		}
		const target = byKey.get(t.to);
		if (!target) continue;
		if (target.type === 'lost' && !(t.requires_comment && hasFieldCondition(t.conditions, 'loss_reason_id'))) {
			issues.push(issue('warning', 'lost_without_reason', `Переход «${label(t)}» в отказ: рекомендуется требовать комментарий и условие «Причина отказа заполнена»`, [], [t.key]));
		}
		if (target.type === 'won' && !(hasFieldCondition(t.conditions, 'amount') && hasFieldCondition(t.conditions, 'expected_close_date'))) {
			issues.push(issue('warning', 'won_without_conditions', `Переход «${label(t)}» в успех: рекомендуется условие по сумме и ожидаемой дате закрытия`, [], [t.key]));
		}
	}

	// --- SLA
	const activeSla = new Map<string, number>();
	for (const r of draft.sla_rules) {
		if (!liveKeys.has(r.status)) continue;
		const s = byKey.get(r.status);
		if (!(r.max_duration_hours > 0 && r.max_duration_hours <= 24 * 365)) {
			issues.push(issue('error', 'sla_invalid', `SLA статуса «${s?.name ?? '?'}»: срок должен быть от 1 часа до года`, [r.status]));
		}
		if (!(Number.isInteger(r.warn_threshold_pct) && r.warn_threshold_pct >= 1 && r.warn_threshold_pct <= 100)) {
			issues.push(issue('error', 'sla_invalid', `SLA статуса «${s?.name ?? '?'}»: порог предупреждения — от 1 до 100 %`, [r.status]));
		}
		if (r.is_active) activeSla.set(r.status, (activeSla.get(r.status) ?? 0) + 1);
	}
	for (const [key, count] of activeSla) {
		if (count > 1) issues.push(issue('error', 'sla_duplicate', `У статуса «${byKey.get(key)?.name ?? '?'}» больше одного активного SLA-правила`, [key]));
	}

	return issues;
}

export const hasErrors = (issues: readonly GraphIssue[]): boolean => issues.some((i) => i.severity === 'error');

export function issuesByStatus(issues: readonly GraphIssue[]): Map<string, GraphIssue[]> {
	const map = new Map<string, GraphIssue[]>();
	for (const i of issues) for (const k of i.statusKeys) map.set(k, [...(map.get(k) ?? []), i]);
	return map;
}
export function issuesByTransition(issues: readonly GraphIssue[]): Map<string, GraphIssue[]> {
	const map = new Map<string, GraphIssue[]>();
	for (const i of issues) for (const k of i.transitionKeys) map.set(k, [...(map.get(k) ?? []), i]);
	return map;
}

/**
 * Серверный `/validate` отдаёт плоские строки. Привязываем их к узлам по коду статуса и к рёбрам по имени перехода
 * (`transitions[<имя>]…`). Формулировки — из workflow/service.py `_validate_graph_data`.
 */
export function parseServerIssues(errors: readonly string[], warnings: readonly string[], draft: GraphDraft): GraphIssue[] {
	const byCode = new Map(draft.statuses.map((s) => [s.code, s.key] as const));
	const keysByCodes = (list: string): string[] =>
		list
			.split(',')
			.map((c) => c.trim())
			.map((c) => byCode.get(c))
			.filter((k): k is string => Boolean(k));
	const transitionKeysByName = (name: string): string[] => draft.transitions.filter((t) => t.name === name).map((t) => t.key);

	const classify = (text: string, severity: GraphIssue['severity']): GraphIssue => {
		let m = /Недостижимые из initial статусы:\s*(.+)$/.exec(text);
		if (m) return { severity, code: 'unreachable', message: text, statusKeys: keysByCodes(m[1]), transitionKeys: [], source: 'server' };
		m = /\(ловушки\):\s*(.+)$/.exec(text);
		if (m) return { severity, code: 'trap', message: text, statusKeys: keysByCodes(m[1]), transitionKeys: [], source: 'server' };
		m = /transitions\[(.+?)\]/.exec(text);
		if (m) return { severity, code: /on_rejected/.test(text) ? 'signature_on_rejected' : /\.actions/.test(text) ? 'action' : 'condition', message: text, statusKeys: [], transitionKeys: transitionKeysByName(m[1]), source: 'server' };
		m = /Переход «(.+?)»/.exec(text);
		if (m) return { severity, code: /lost/.test(text) ? 'lost_without_reason' : 'won_without_conditions', message: text, statusKeys: [], transitionKeys: transitionKeysByName(m[1]), source: 'server' };
		if (/типа initial/.test(text)) {
			return { severity, code: 'initial_count', message: text, statusKeys: draft.statuses.filter((s) => s.type === 'initial' && !s.is_archived).map((s) => s.key), transitionKeys: [], source: 'server' };
		}
		if (/терминальн/.test(text)) return { severity, code: 'no_terminal', message: text, statusKeys: [], transitionKeys: [], source: 'server' };
		return { severity, code: 'server', message: text, statusKeys: [], transitionKeys: [], source: 'server' };
	};

	return [...errors.map((e) => classify(e, 'error')), ...warnings.map((w) => classify(w, 'warning'))];
}

/** Быстрая проверка одного перехода для панели свойств (без графовых проверок). */
export function transitionIssues(t: TransitionDraft, draft: GraphDraft, ctx: GraphValidationContext = {}): string[] {
	const liveCodes = new Set(draft.statuses.filter((s) => !s.is_archived).map((s) => s.code));
	const errors: string[] = [];
	if (!t.name.trim()) errors.push('Укажите название перехода');
	if (t.from === t.to) errors.push('Переход не может вести в тот же статус');
	if (!isEmptyCondition(t.conditions)) errors.push(...validateCondition(t.conditions, { knownCustomFields: ctx.knownCustomFields, path: 'Условия' }));
	errors.push(...validateActions(t.actions, { statusCodes: liveCodes, path: 'Действие' }));
	return errors;
}
