import { describe, expect, it } from 'vitest';
import { eventCodeInfo, notificationHref } from './eventCodes';

// Коды из `GET /api/notifications/event-codes` на момент спринта F3: у каждого должна быть русская подпись, а не сам код.
const BACKEND_CODES = [
	'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_CREATED', 'ACCESS_REQUEST_REJECTED',
	'DEAL_DELETED', 'DEAL_EVENT', 'DEAL_MENTION', 'DEAL_REASSIGNED', 'DEAL_SLA_BREACHED', 'DEAL_SLA_WARNING', 'EDM_AGREEMENT_MISSING',
	'ERASURE_ACT_NO_SIGNER', 'ERASURE_COMPLETED', 'ERASURE_REQUEST_BLOCKED', 'ORG_DRIFT_APPLIED', 'ORG_LIQUIDATION_DETECTED',
	'ORG_OWNER_ASSIGNED', 'ORG_OWNER_REMOVED', 'ORG_REQUISITES_DRIFT_DETECTED', 'SIGNATURE_AUTO_ADVANCED', 'SIGNATURE_DEADLINE_REMINDER',
	'SIGNATURE_DOCUMENT_EXPIRED', 'SIGNATURE_DOCUMENT_REJECTED', 'SIGNATURE_DOCUMENT_SIGNED', 'SIGNATURE_OTP_LOCKED',
	'SIGNATURE_REMINDER_MANUAL', 'SIGNATURE_REQUESTED', 'USER_ACCOUNT_BLOCKED', 'USER_ACCOUNT_UNBLOCKED', 'USER_INVITE_EXPIRED',
	'SECURITY_INCIDENT_CANDIDATE', 'SECURITY_INCIDENT_DEADLINE', 'USER_OFFBOARD_SUCCESSOR', 'USER_PASSWORD_CHANGED', 'USER_PASSWORD_RESET', 'USER_ROLE_CHANGED'
];

describe('eventCodeInfo', () => {
	it.each(BACKEND_CODES)('%s подписан по-русски', (code) => {
		const info = eventCodeInfo(code);
		expect(info.label).not.toBe(code);
		expect(info.group).not.toBe('other');
	});

	it('события об инцидентах безопасности приходят только тем, у кого есть право на инциденты: у остальных строки скрыты', () => {
		expect(eventCodeInfo('SECURITY_INCIDENT_CANDIDATE').needs).toBe('incident:manage');
		expect(eventCodeInfo('SECURITY_INCIDENT_DEADLINE').needs).toBe('incident:manage');
		expect(eventCodeInfo('DEAL_EVENT').needs).toBeUndefined();
	});

	it('неизвестный код показывается как есть', () => {
		expect(eventCodeInfo('SOMETHING_NEW')).toEqual({ code: 'SOMETHING_NEW', label: 'SOMETHING_NEW', group: 'other' });
	});
});

// Какой объект бэкенд кладёт в уведомление каждого кода (`entity_type`; app/modules/**: notify_user(...)) и куда оно должно вести.
// Тест ломается, когда у нового кода события нет строки: `BACKEND_CODES` — полный список кодов, у каждого обязан быть ожидаемый переход.
const ID = '01a15176-078f-7000-97a2-8df34227f575';
const LINKS: Record<string, { entity: string | null; href: string | null }> = {
	ACCESS_REQUEST_CREATED: { entity: 'organization', href: '/access-requests?box=inbox' },
	ACCESS_REQUEST_APPROVED: { entity: 'organization', href: `/organizations/${ID}` },
	ACCESS_REQUEST_REJECTED: { entity: 'organization', href: '/access-requests?box=mine' },
	DEAL_DELETED: { entity: 'deal', href: `/deals/${ID}` },
	DEAL_EVENT: { entity: 'deal', href: `/deals/${ID}` },
	DEAL_MENTION: { entity: 'deal', href: `/deals/${ID}` },
	DEAL_REASSIGNED: { entity: 'deal', href: `/deals/${ID}` },
	DEAL_SLA_BREACHED: { entity: 'deal', href: `/deals/${ID}` },
	DEAL_SLA_WARNING: { entity: 'deal', href: `/deals/${ID}` },
	EDM_AGREEMENT_MISSING: { entity: 'signature_document', href: `/signing/${ID}` },
	ERASURE_ACT_NO_SIGNER: { entity: 'data_erasure_request', href: `/admin/erasure/${ID}` },
	ERASURE_COMPLETED: { entity: 'data_erasure_request', href: `/admin/erasure/${ID}` },
	ERASURE_REQUEST_BLOCKED: { entity: 'data_erasure_request', href: `/admin/erasure/${ID}` },
	ORG_DRIFT_APPLIED: { entity: 'organization', href: `/organizations/${ID}` },
	ORG_LIQUIDATION_DETECTED: { entity: 'organization', href: `/organizations/${ID}` },
	ORG_OWNER_ASSIGNED: { entity: 'organization', href: `/organizations/${ID}` },
	ORG_OWNER_REMOVED: { entity: 'organization', href: `/organizations/${ID}` },
	ORG_REQUISITES_DRIFT_DETECTED: { entity: 'organization', href: `/organizations/${ID}` },
	SECURITY_INCIDENT_CANDIDATE: { entity: 'security_incident', href: '/admin/incidents?status=candidate' },
	SECURITY_INCIDENT_DEADLINE: { entity: 'security_incident', href: `/admin/incidents/${ID}` },
	SIGNATURE_AUTO_ADVANCED: { entity: 'deal', href: `/deals/${ID}` },
	SIGNATURE_DEADLINE_REMINDER: { entity: 'signature_request', href: `/signing/requests/${ID}` },
	SIGNATURE_DOCUMENT_EXPIRED: { entity: 'signature_document', href: `/signing/${ID}` },
	SIGNATURE_DOCUMENT_REJECTED: { entity: 'signature_document', href: `/signing/${ID}` },
	SIGNATURE_DOCUMENT_SIGNED: { entity: 'signature_document', href: `/signing/${ID}` },
	SIGNATURE_OTP_LOCKED: { entity: 'signature_request', href: '/signing?tab=docs' },
	SIGNATURE_REMINDER_MANUAL: { entity: 'signature_request', href: '/signing?tab=docs' },
	SIGNATURE_REQUESTED: { entity: 'signature_request', href: `/signing/requests/${ID}` },
	USER_ACCOUNT_BLOCKED: { entity: null, href: null },
	USER_ACCOUNT_UNBLOCKED: { entity: 'user', href: '/profile' },
	USER_INVITE_EXPIRED: { entity: 'user', href: `/admin/users/${ID}` },
	USER_OFFBOARD_SUCCESSOR: { entity: null, href: '/deals' },
	USER_PASSWORD_CHANGED: { entity: 'user', href: '/profile' },
	USER_PASSWORD_RESET: { entity: 'user', href: '/profile' },
	USER_ROLE_CHANGED: { entity: null, href: null }
};

describe('notificationHref', () => {
	it('у каждого кода события описан переход', () => {
		expect(Object.keys(LINKS).sort()).toEqual([...BACKEND_CODES].sort());
	});

	it.each(Object.entries(LINKS))('%s', (code, { entity, href }) => {
		// INVITE_EXPIRED получает администратор о чужой учётной записи, остальные про себя
		const mine = code !== 'USER_INVITE_EXPIRED';
		const meId = mine ? ID : 'другой';
		const n = { template_code: code, entity_type: entity, entity_id: entity ? ID : null, payload: {} };
		expect(notificationHref(n, { meId, can: () => true })).toBe(href);
	});

	it('чужая учётная запись без права «пользователи» никуда не ведёт', () => {
		const n = { template_code: 'USER_INVITE_EXPIRED', entity_type: 'user', entity_id: ID };
		expect(notificationHref(n, { meId: 'x', can: () => false })).toBeNull();
	});

	it('нет соглашения об ЭДО без объекта: документ берётся из payload', () => {
		const n = { template_code: 'EDM_AGREEMENT_MISSING', entity_type: null, entity_id: null, payload: { document_id: ID } };
		expect(notificationHref(n)).toBe(`/signing/${ID}`);
	});

	it('неизвестный код с известным объектом — по типу объекта; без объекта — никуда', () => {
		expect(notificationHref({ template_code: 'NEW_CODE', entity_type: 'deal', entity_id: ID })).toBe(`/deals/${ID}`);
		expect(notificationHref({ template_code: 'NEW_CODE', entity_type: null, entity_id: null })).toBeNull();
	});
});
