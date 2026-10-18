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
