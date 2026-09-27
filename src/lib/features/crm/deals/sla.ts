// Состояние SLA сделки на клиенте (new_spec §4.10). Воркер бэкенда обновляет `sla_state` раз в 15 минут
// (backend/app/modules/crm/tasks.py: пороги 0.75 и 1.0), поэтому индикатор считает долю прошедшего времени сам —
// без этого сделка, у которой срок истёк минуту назад, до четверти часа выглядела бы «в норме».

import { formatDurationShort } from '../shared/duration';

export const SLA_WARN_THRESHOLD = 0.75;
export const SLA_BREACH_THRESHOLD = 1;

export type SlaState = 'ok' | 'warning' | 'breached' | 'paused';
/** `none` — таймера нет: статус без правила SLA или сделка закрыта. */
export type SlaDisplayState = SlaState | 'none';

export interface SlaSource {
	status_changed_at: string;
	sla_due_at?: string | null;
	sla_state: string;
	closed_at?: string | null;
}

export interface SlaProgress {
	state: SlaDisplayState;
	/** Доля израсходованного срока (0..∞), `null` без таймера. */
	fraction: number | null;
	/** Сколько осталось (мс, ≥ 0), `null` без таймера или после нарушения. */
	remainingMs: number | null;
	/** На сколько просрочено (мс, > 0) при нарушении, иначе `null`. */
	overdueMs: number | null;
	dueAt: Date | null;
}

const toMs = (iso: string | null | undefined): number | null => {
	if (!iso) return null;
	const t = Date.parse(iso);
	return Number.isNaN(t) ? null : t;
};

export function slaProgress(deal: SlaSource, now: number = Date.now()): SlaProgress {
	const empty: SlaProgress = { state: 'none', fraction: null, remainingMs: null, overdueMs: null, dueAt: null };
	if (deal.closed_at) return empty;
	if (deal.sla_state === 'paused') return { ...empty, state: 'paused' };

	const due = toMs(deal.sla_due_at);
	const start = toMs(deal.status_changed_at);
	if (due === null || start === null) return empty;

	const total = due - start;
	const dueAt = new Date(due);
	if (total <= 0) {
		// Некорректный или нулевой срок: считаем только по факту дедлайна.
		const overdue = now - due;
		return overdue > 0
			? { state: 'breached', fraction: 1, remainingMs: null, overdueMs: overdue, dueAt }
			: { state: 'ok', fraction: 0, remainingMs: -overdue, overdueMs: null, dueAt };
	}

	const fraction = (now - start) / total;
	if (fraction >= SLA_BREACH_THRESHOLD) {
		return { state: 'breached', fraction, remainingMs: null, overdueMs: now - due, dueAt };
	}
	return {
		state: fraction >= SLA_WARN_THRESHOLD ? 'warning' : 'ok',
		fraction: Math.max(0, fraction),
		remainingMs: due - now,
		overdueMs: null,
		dueAt
	};
}

/**
 * Текст для индикатора: «Осталось 2 д 3 ч», «Просрочено на 5 ч», «На паузе», «—» (с заглавной, как названия статусов рядом).
 * `compact` (таблица, доска): «2 д 3 ч», «−5 ч», «пауза» — слова только в подсказке.
 */
export function slaLabel(progress: SlaProgress, compact = false): string {
	const short = (ms: number | null): string => (ms !== null && Math.abs(ms) < 60_000 ? '< 1 мин' : formatDurationShort(ms));
	switch (progress.state) {
		case 'paused':
			return compact ? 'Пауза' : 'На паузе';
		case 'breached':
			return compact ? `−${short(progress.overdueMs)}` : `Просрочено на ${formatDurationShort(progress.overdueMs)}`;
		case 'warning':
		case 'ok':
			return compact ? short(progress.remainingMs) : `Осталось ${formatDurationShort(progress.remainingMs)}`;
		default:
			return '—';
	}
}

/** Цветовая схема rt-ui (Badge/Progress/Counter) по состоянию SLA. */
export function slaColorScheme(state: SlaDisplayState): 'success' | 'warning' | 'error' | 'neutral' {
	if (state === 'ok') return 'success';
	if (state === 'warning') return 'warning';
	if (state === 'breached') return 'error';
	return 'neutral';
}
