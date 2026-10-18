// Мастер передачи дел (new_spec §4.7): сводка preview и проверка шага подтверждения.
import { plural } from '$lib/utils/format';
import type { OffboardItem } from './types';

export interface CriticalDeal {
	id: string;
	number: string;
	title: string;
	status: string;
}

export interface WorkloadSummary {
	deals: number;
	tasks: number;
	imports: number;
	reports: number;
	/** вузы, где сотрудник ответственный (с B4-4; у старого бэкенда нет) */
	organizations: number;
	signatureRequests: number;
	criticalDeals: CriticalDeal[];
	/** Модуль сделок недоступен: счётчики нулевые не потому, что дел нет. */
	unsupported: boolean;
	isEmpty: boolean;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function summarizeWorkload(items: readonly OffboardItem[]): WorkloadSummary {
	const byKind = new Map(items.map((i) => [i.kind, i]));
	const count = (kind: string): number => byKind.get(kind)?.count ?? 0;
	const dealsItem = byKind.get('deals');
	const criticalDeals: CriticalDeal[] = (dealsItem?.details ?? []).map((d) => ({
		id: str(d.id),
		number: str(d.number),
		title: str(d.title),
		status: str(d.status ?? d.status_code ?? d.status_name)
	}));
	const unsupported = items.some((i) => i.supported === false);
	const summary = {
		deals: count('deals'),
		tasks: count('tasks'),
		imports: count('imports'),
		organizations: count('organizations'),
		reports: count('reports'),
		signatureRequests: count('signature_requests'),
		criticalDeals,
		unsupported
	};
	const isEmpty =
		!unsupported &&
		summary.deals + summary.tasks + summary.imports + summary.reports + summary.signatureRequests + summary.organizations === 0;
	return { ...summary, isEmpty };
}

export interface OffboardForm {
	userId: string;
	successorId: string | null;
	reason: string;
	acknowledged: boolean;
}

export interface OffboardValidation {
	ok: boolean;
	errors: Partial<Record<'successorId' | 'reason' | 'acknowledged', string>>;
}

export const OFFBOARD_REASON_MIN = 3;
export const OFFBOARD_REASON_MAX = 500;

/** Проверка перед `mode: 'confirm'` — зеркало `OffboardRequest` и `offboard_confirm`. */
export function validateOffboard(form: OffboardForm, step: 'successor' | 'confirm' = 'confirm'): OffboardValidation {
	const errors: OffboardValidation['errors'] = {};
	if (!form.successorId) errors.successorId = 'Выберите преемника';
	else if (form.successorId === form.userId) errors.successorId = 'Преемник не может совпадать с увольняемым';
	const reason = form.reason.trim();
	if (reason.length < OFFBOARD_REASON_MIN) errors.reason = `Укажите причину (не короче ${OFFBOARD_REASON_MIN} символов)`;
	else if (reason.length > OFFBOARD_REASON_MAX) errors.reason = `Не длиннее ${OFFBOARD_REASON_MAX} символов`;
	if (step === 'confirm' && !form.acknowledged) errors.acknowledged = 'Подтвердите, что понимаете необратимость';
	return { ok: Object.keys(errors).length === 0, errors };
}

export const dealsWord = (n: number): string => plural(n, ['сделка', 'сделки', 'сделок']);
export const tasksWord = (n: number): string => plural(n, ['задача', 'задачи', 'задач']);
export const requestsWord = (n: number): string => plural(n, ['запрос', 'запроса', 'запросов']);
