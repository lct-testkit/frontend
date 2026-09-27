import { describe, expect, it } from 'vitest';
import { APPROVAL_STATUS_HINTS, AUDIT_RESULT_HINTS, ERASURE_STATUS_HINTS, ROLE_HINTS, USER_STATUS_HINTS } from './hints';
import { ROLE_LABEL, approvalStatusMeta, auditResultMeta, erasureStatusMeta, userStatusMeta } from './labels';

const known = (hints: Record<string, string>, meta: (k: string) => { label: string }) => {
	for (const [key, text] of Object.entries(hints)) {
		expect(meta(key).label, key).not.toBe(key); // the key is a real enum value: it has its own label
		expect(text.length, key).toBeGreaterThan(10);
	}
};

describe('identity hints', () => {
	it('every role is explained', () => expect(Object.keys(ROLE_HINTS).sort()).toEqual(Object.keys(ROLE_LABEL).sort()));
	it('every user status is explained', () => {
		known(USER_STATUS_HINTS, userStatusMeta);
		expect(Object.keys(USER_STATUS_HINTS)).toHaveLength(5);
	});
	it('every erasure status is explained', () => {
		known(ERASURE_STATUS_HINTS, erasureStatusMeta);
		expect(Object.keys(ERASURE_STATUS_HINTS)).toHaveLength(5);
	});
	it('every approval status is explained', () => {
		known(APPROVAL_STATUS_HINTS, approvalStatusMeta);
		expect(Object.keys(APPROVAL_STATUS_HINTS)).toHaveLength(5);
	});
	it('every audit result is explained', () => {
		known(AUDIT_RESULT_HINTS, auditResultMeta);
		expect(Object.keys(AUDIT_RESULT_HINTS)).toHaveLength(3);
	});
});
