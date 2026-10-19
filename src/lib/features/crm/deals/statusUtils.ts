// Чистые функции над графом воронки: порядок шагов, тон статуса, классификация переходов для кнопок.
import { ROLE_LABEL } from '$lib/auth/session.svelte';
import type { AvailableTransition, WorkflowGraph, WorkflowStatus } from '../types';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const TONE: Record<string, StatusTone> = { initial: 'neutral', intermediate: 'info', won: 'success', lost: 'error', parked: 'warning' };

/** Название статуса для показа: воронки настраиваются вручную, а везде рядом названия с заглавной — первую букву делаем заглавной. */
export const statusName = (name: string | null | undefined): string => {
	const t = (name ?? '').trim();
	return t ? t[0].toLocaleUpperCase('ru') + t.slice(1) : '';
};

export const statusTone = (type: string | null | undefined): StatusTone => TONE[type ?? ''] ?? 'neutral';

export const isTerminal = (status: Pick<WorkflowStatus, 'type'> | null | undefined): boolean =>
	!!status && (status.type === 'won' || status.type === 'lost' || status.type === 'parked');

/** Шаги воронки по порядку: начальный и промежуточные (без архивных). */
export function steps(graph: WorkflowGraph | null | undefined): WorkflowStatus[] {
	return (graph?.statuses ?? [])
		.filter((s) => !s.is_archived && (s.type === 'initial' || s.type === 'intermediate'))
		.sort((a, b) => a.sort_order - b.sort_order);
}

/** Терминальные статусы: успех, отказ, заморозка. */
export function terminals(graph: WorkflowGraph | null | undefined): WorkflowStatus[] {
	return (graph?.statuses ?? []).filter((s) => !s.is_archived && isTerminal(s)).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Вид перехода для кнопок: вперёд на ближний шаг, `skip` — вперёд через шаг (необязательный), `back` — назад, `resume` — из заморозки на шаг,
 * `won` / `lost` / `parked` — терминальные статусы.
 */
export type TransitionKind = 'forward' | 'skip' | 'back' | 'resume' | 'won' | 'lost' | 'parked';

/** Номер шага в ленте (по порядку), -1 — не шаг (терминальный статус или архивный). */
const stepIndexOf = (list: readonly WorkflowStatus[] | undefined, id: string | undefined): number => (list && id ? list.findIndex((s) => s.id === id) : -1);

export function transitionKind(target: WorkflowStatus | undefined, current: WorkflowStatus | undefined, stepList?: readonly WorkflowStatus[]): TransitionKind {
	if (!target) return 'forward';
	if (target.type === 'won') return 'won';
	if (target.type === 'lost') return 'lost';
	if (target.type === 'parked') return 'parked';
	// из заморозки любой переход на шаг — возобновление (порядок «Заморожена» больше любого шага, «назад» было бы ложью)
	if (current?.type === 'parked') return 'resume';
	if (current && target.sort_order < current.sort_order) return 'back';
	const from = stepIndexOf(stepList, current?.id);
	const to = stepIndexOf(stepList, target.id);
	return from >= 0 && to > from + 1 ? 'skip' : 'forward';
}

/**
 * Необязательные шаги: шаг необязателен, если в графе есть переход с предыдущего шага сразу на следующий («через шаг»).
 * Признак выводится из графа, отдельного поля у статуса нет.
 */
export function optionalStepIds(graph: WorkflowGraph | null | undefined): Set<string> {
	const list = steps(graph);
	const edges = new Set((graph?.transitions ?? []).map((t) => `${t.from_status_id}>${t.to_status_id}`));
	const result = new Set<string>();
	for (let i = 1; i < list.length - 1; i += 1) if (edges.has(`${list[i - 1].id}>${list[i + 1].id}`)) result.add(list[i].id);
	return result;
}

export interface ClassifiedTransition {
	transition: AvailableTransition;
	target: WorkflowStatus | undefined;
	kind: TransitionKind;
}

export interface TransitionButtons {
	primary: ClassifiedTransition | null;
	/** до двух заметных вторичных (заморозка, отказ) */
	secondary: ClassifiedTransition[];
	/** остальное — в меню «Ещё» */
	more: ClassifiedTransition[];
}

export interface ClassifyOptions {
	/** шаги воронки по порядку: по ним отличается «вперёд» от «через шаг» */
	steps?: readonly WorkflowStatus[];
	/** шаг, на котором сделка остановилась перед заморозкой: «Возобновить» на него — главная кнопка */
	stoppedAt?: string | null;
}

/**
 * Какие переходы вынести кнопками: главный — доступный «вперёд» с ближайшим шагом (или «успешно закрыть», если вперёд некуда;
 * у замороженной — «возобновить» на шаг остановки), рядом — «Заморозить» и «Отказ», всё остальное (через шаг, возврат назад,
 * остальные «возобновить», недоступные роли) — в меню.
 */
export function classifyTransitions(
	items: AvailableTransition[],
	statusOf: (id: string) => WorkflowStatus | undefined,
	current: WorkflowStatus | undefined,
	options: ClassifyOptions = {}
): TransitionButtons {
	const all = items.map<ClassifiedTransition>((transition) => {
		const target = statusOf(transition.to_status_id);
		return { transition, target, kind: transitionKind(target, current, options.steps) };
	});
	const allowed = all.filter((c) => c.transition.role_allowed);
	const nearest = allowed.filter((c) => c.kind === 'forward').sort((a, b) => (a.target?.sort_order ?? 0) - (b.target?.sort_order ?? 0))[0];
	const resumed = options.stoppedAt ? allowed.find((c) => c.kind === 'resume' && c.target?.id === options.stoppedAt) : undefined;
	const primary = nearest ?? resumed ?? allowed.find((c) => c.kind === 'won') ?? null;
	const secondary = allowed.filter((c) => c !== primary && (c.kind === 'parked' || c.kind === 'lost')).slice(0, 2);
	const more = all.filter((c) => c !== primary && !secondary.includes(c));
	return { primary, secondary, more };
}

export type StepState = 'done' | 'skipped' | 'current' | 'earlier' | 'future' | 'stopped';

/**
 * Состояния шагов ленты. Слева от текущего: `skipped` — сделка там не бывала по истории переходов (так же считает вкладка «Этапы»: «Пропущен» =
 * ни одного захода), иначе `done`. Пока истории нет (не загрузилась или пуста), пропуском считается только необязательный шаг; справа: `earlier` — сделка там уже
 * была (после возврата), иначе `future`. Остановленная (заморозка, отказ) — `stopped` на шаге остановки. После переноса на другую воронку
 * (`migrated`) пропусков нет: шаги нового графа сделка не проходила.
 */
export function stepStates(
	list: readonly WorkflowStatus[],
	currentIndex: number,
	visited: ReadonlySet<string>,
	optional: ReadonlySet<string>,
	stopped: boolean,
	migrated = false
): StepState[] {
	return list.map((step, i) => {
		if (currentIndex < 0) return 'future';
		if (i === currentIndex) return stopped ? 'stopped' : 'current';
		if (i < currentIndex) return !migrated && !visited.has(step.id) && (visited.size > 0 || optional.has(step.id)) ? 'skipped' : 'done';
		return visited.has(step.id) && !migrated ? 'earlier' : 'future';
	});
}

/**
 * Кому доступен переход: роли из графа воронки (`allowed_roles`) и Администратор (бэкенд допускает его всегда).
 * «Руководитель, Администратор»; у перехода без ограничения по ролям — `null`.
 */
export function roleHint(transition: Pick<AvailableTransition, 'id'> | undefined, graph: WorkflowGraph | null | undefined): string | null {
	return roleList(graph?.transitions?.find((t) => t.id === transition?.id)?.allowed_roles);
}

/** То же по готовому списку ролей (например, из `extra.allowed_roles` отказа `CRM-1202`). */
export function roleList(roles: readonly unknown[] | null | undefined): string | null {
	const codes = (roles ?? []).filter((r): r is string => typeof r === 'string' && r !== '');
	if (!codes.length) return null;
	const all = codes.includes('ADMIN') ? codes : [...codes, 'ADMIN'];
	return [...new Set(all)].map((r) => ROLE_LABEL[r] ?? r).join(', ');
}

/** Подсказка у недоступного роли перехода: «Недоступно вашей роли. Только: Руководитель, Администратор». */
export const deniedText = (who: string | null): string => (who ? `Недоступно вашей роли. Только: ${who}` : 'Недоступно вашей роли');

/** Пункты меню «Перевести» на карточке доски: куда можно перейти из текущего статуса; недоступные роли серые, с подсказкой. */
export function moveMenuItems(items: AvailableTransition[], statusOf: (id: string) => WorkflowStatus | undefined) {
	return items.map((t) => {
		const to = statusOf(t.to_status_id)?.name;
		return {
			key: t.id,
			value: to ? `В статус «${statusName(to)}»` : t.name,
			hint: t.role_allowed ? undefined : 'Недоступно вашей роли',
			disabled: !t.role_allowed
		};
	});
}
