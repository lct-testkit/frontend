// Запросы доступа к чужому вузу (B4-12): статусы, срок доступа, что можно сделать с запросом.
import type { AccessRequest } from '../types';

export type RequestTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const REQUEST_STATUS: Record<string, { label: string; tone: RequestTone; hint: string }> = {
	pending: { label: 'Ожидает решения', tone: 'warning', hint: 'Владелец вуза, руководитель его команды или администратор ещё не ответили.' },
	approved: { label: 'Одобрен', tone: 'success', hint: 'Вуз виден в вашем списке до конца срока.' },
	rejected: { label: 'Отклонён', tone: 'error', hint: 'Доступ не дали — причина указана в комментарии.' },
	cancelled: { label: 'Отменён', tone: 'neutral', hint: 'Инициатор отозвал запрос до ответа.' },
	revoked: { label: 'Доступ отозван', tone: 'neutral', hint: 'Выданный доступ снят до конца срока.' },
	expired: { label: 'Срок истёк', tone: 'neutral', hint: 'Запрос не рассмотрели за 14 дней или срок доступа вышел.' }
};

export const REQUEST_STATUS_FILTERS = [
	{ key: 'pending', value: 'Ожидают решения' },
	{ key: 'approved', value: 'Одобрены' },
	{ key: 'rejected', value: 'Отклонены' },
	{ key: 'all', value: 'Все' }
] as const;

export const DEFAULT_ACCESS_DAYS = 30;
export const MAX_ACCESS_DAYS = 365;

/** Одобренный запрос после `expires_at` — для человека уже «срок истёк». */
export function effectiveStatus(r: Pick<AccessRequest, 'status' | 'expires_at'>, now = Date.now()): string {
	if (r.status === 'approved' && r.expires_at && Date.parse(r.expires_at) <= now) return 'expired';
	return r.status;
}

export function statusMeta(status: string) {
	return REQUEST_STATUS[status] ?? { label: status, tone: 'neutral' as RequestTone, hint: '' };
}

export interface RequestActions {
	/** решить (одобрить/отклонить): во входящих, пока ждёт */
	decide: boolean;
	/** снять выданный доступ: во входящих, пока действует */
	revoke: boolean;
	/** отменить свой ожидающий запрос */
	cancel: boolean;
	/** открыть вуз: доступ действует */
	open: boolean;
}

export function requestActions(r: AccessRequest, box: 'inbox' | 'mine', now = Date.now()): RequestActions {
	const status = effectiveStatus(r, now);
	return {
		decide: box === 'inbox' && status === 'pending',
		revoke: box === 'inbox' && status === 'approved',
		cancel: box === 'mine' && status === 'pending',
		open: status === 'approved'
	};
}

/** Проверка срока из формы одобрения: целое 1..365. */
export function validateDays(days: number | null): string | null {
	if (days === null) return 'Укажите срок в днях';
	if (!Number.isInteger(days) || days < 1 || days > MAX_ACCESS_DAYS) return `От 1 до ${MAX_ACCESS_DAYS} дней`;
	return null;
}

/** «Доступ до 18.11.2026» — для одобренных; прочерк у остальных. */
export function accessUntil(r: Pick<AccessRequest, 'status' | 'expires_at'>, fmt: (iso: string) => string): string | null {
	return r.status === 'approved' && r.expires_at ? `до ${fmt(r.expires_at)}` : null;
}

/** Подходит ли запрос под фильтр статуса (бэкенд игнорирует `status` для «Моих запросов», поэтому фильтруем и на клиенте). */
export function matchesStatus(r: Pick<AccessRequest, 'status' | 'expires_at'>, key: string, now = Date.now()): boolean {
	if (key === 'all') return true;
	return effectiveStatus(r, now) === key;
}
