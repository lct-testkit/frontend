// Чистые функции над графом воронки: порядок шагов, тон статуса, классификация переходов для кнопок.
import type { AvailableTransition, WorkflowGraph, WorkflowStatus } from '../types';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const TONE: Record<string, StatusTone> = { initial: 'neutral', intermediate: 'info', won: 'success', lost: 'error', parked: 'warning' };

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

export type TransitionKind = 'forward' | 'back' | 'won' | 'lost' | 'parked';

export function transitionKind(target: WorkflowStatus | undefined, current: WorkflowStatus | undefined): TransitionKind {
	if (!target) return 'forward';
	if (target.type === 'won') return 'won';
	if (target.type === 'lost') return 'lost';
	if (target.type === 'parked') return 'parked';
	return current && target.sort_order < current.sort_order ? 'back' : 'forward';
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

/**
 * Какие переходы вынести кнопками: главный — первый доступный «вперёд» (или «успешно закрыть», если вперёд некуда),
 * рядом — «Заморозить» и «Отказ», всё остальное (возврат назад, недоступные роли) — в меню.
 */
export function classifyTransitions(
	items: AvailableTransition[],
	statusOf: (id: string) => WorkflowStatus | undefined,
	current: WorkflowStatus | undefined
): TransitionButtons {
	const all = items.map<ClassifiedTransition>((transition) => {
		const target = statusOf(transition.to_status_id);
		return { transition, target, kind: transitionKind(target, current) };
	});
	const allowed = all.filter((c) => c.transition.role_allowed);
	const primary = allowed.find((c) => c.kind === 'forward') ?? allowed.find((c) => c.kind === 'won') ?? null;
	const secondary = allowed.filter((c) => c !== primary && (c.kind === 'parked' || c.kind === 'lost')).slice(0, 2);
	const more = all.filter((c) => c !== primary && !secondary.includes(c));
	return { primary, secondary, more };
}
