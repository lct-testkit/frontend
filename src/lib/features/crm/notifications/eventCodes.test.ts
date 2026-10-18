import { describe, expect, it } from 'vitest';
import { eventCodeInfo } from './eventCodes';

// Коды из `GET /api/notifications/event-codes` на момент спринта F3: у каждого должна быть русская подпись, а не сам код.
const BACKEND_CODES = [
	'DEAL_DELETED', 'DEAL_EVENT', 'DEAL_MENTION', 'DEAL_REASSIGNED', 'DEAL_SLA_BREACHED', 'DEAL_SLA_WARNING', 'EDM_AGREEMENT_MISSING',
	'ERASURE_ACT_NO_SIGNER', 'ERASURE_COMPLETED', 'ERASURE_REQUEST_BLOCKED', 'ORG_DRIFT_APPLIED', 'ORG_LIQUIDATION_DETECTED',
	'ORG_OWNER_ASSIGNED', 'ORG_OWNER_REMOVED', 'ORG_REQUISITES_DRIFT_DETECTED', 'SIGNATURE_AUTO_ADVANCED', 'SIGNATURE_DEADLINE_REMINDER',
	'SIGNATURE_DOCUMENT_EXPIRED', 'SIGNATURE_DOCUMENT_REJECTED', 'SIGNATURE_DOCUMENT_SIGNED', 'SIGNATURE_OTP_LOCKED',
	'SIGNATURE_REMINDER_MANUAL', 'SIGNATURE_REQUESTED', 'USER_ACCOUNT_BLOCKED', 'USER_ACCOUNT_UNBLOCKED', 'USER_INVITE_EXPIRED',
	'USER_OFFBOARD_SUCCESSOR', 'USER_PASSWORD_CHANGED', 'USER_PASSWORD_RESET', 'USER_ROLE_CHANGED'
];

describe('eventCodeInfo', () => {
	it.each(BACKEND_CODES)('%s подписан по-русски', (code) => {
		const info = eventCodeInfo(code);
		expect(info.label).not.toBe(code);
		expect(info.group).not.toBe('other');
	});

	it('неизвестный код показывается как есть', () => {
		expect(eventCodeInfo('SOMETHING_NEW')).toEqual({ code: 'SOMETHING_NEW', label: 'SOMETHING_NEW', group: 'other' });
	});
});
