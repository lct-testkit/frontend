// Принцип «четырёх глаз» (CRM-1902, admin_service.ApprovalService): что может сделать текущий админ с заявкой.
import { ERASURE_MODE_LABEL, approvalOperationLabel } from './labels';
import type { ApprovalLike, ErasureMode } from './types';

export interface ApprovalActions {
	canApprove: boolean;
	canReject: boolean;
	/** Заявка подтверждена, инициатор может повторить исходный запрос с `approval_id`. */
	canExecute: boolean;
	/** Своя заявка ещё ждёт второго администратора. */
	waitingForOther: boolean;
	isExpired: boolean;
}

export function approvalActions(a: ApprovalLike, meId: string, now: number = Date.now()): ApprovalActions {
	const mine = a.requested_by === meId;
	const isExpired = new Date(a.expires_at).getTime() <= now;
	const pending = a.status === 'pending' && !isExpired;
	return {
		canApprove: pending && !mine,
		canReject: (pending || a.status === 'approved') && !isExpired,
		canExecute: a.status === 'approved' && mine && !isExpired,
		waitingForOther: pending && mine,
		isExpired: isExpired && (a.status === 'pending' || a.status === 'approved')
	};
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Человеческое описание заявки по `operation` + `payload` (payload — только хэшируемые поля). */
export function describeApproval(a: Pick<ApprovalLike, 'operation' | 'payload'>): string {
	const p = a.payload ?? {};
	switch (a.operation) {
		case 'user.create_admin': {
			const who = [str(p.full_name), str(p.email) && `(${str(p.email)})`].filter(Boolean).join(' ');
			return `Создание администратора ${who}`.trim();
		}
		case 'user.erasure':
		case 'contact.erasure':
		case 'organization.erasure': {
			const mode = ERASURE_MODE_LABEL[str(p.mode) as ErasureMode] ?? str(p.mode);
			return `${approvalOperationLabel(a.operation)}${mode ? `: ${mode.toLowerCase()}` : ''}`;
		}
		default:
			return approvalOperationLabel(a.operation);
	}
}

/** Куда вести кнопкой «Выполнить»: форма с предзаполнением и `approval_id` в query. */
export function approvalExecuteHref(a: Pick<ApprovalLike, 'id' | 'operation' | 'payload'>): string | null {
	const p = a.payload ?? {};
	const q = new URLSearchParams({ approval_id: a.id });
	switch (a.operation) {
		case 'user.create_admin':
			q.set('create', '1');
			if (str(p.email)) q.set('email', str(p.email));
			if (str(p.full_name)) q.set('full_name', str(p.full_name));
			q.set('role', 'ADMIN');
			return `/admin/users?${q}`;
		case 'user.erasure':
			q.set('subject_type', 'user');
			q.set('subject_id', str(p.user_id));
			q.set('mode', str(p.mode));
			return `/admin/erasure?${q}`;
		case 'contact.erasure':
			q.set('subject_type', 'contact');
			q.set('subject_id', str(p.contact_id));
			q.set('mode', str(p.mode));
			return `/admin/erasure?${q}`;
		case 'organization.erasure':
			q.set('subject_type', 'organization');
			q.set('subject_id', str(p.organization_id));
			q.set('mode', str(p.mode));
			return `/admin/erasure?${q}`;
		default:
			return null;
	}
}

/** Из ошибки CRM-1902 достаём id заявки (`extra.approval_id`), чтобы показать «ожидает второго администратора». */
export function approvalIdFromError(extra: Record<string, unknown> | null | undefined): string | null {
	const id = extra?.approval_id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}
