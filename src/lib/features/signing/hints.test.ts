import { describe, expect, it } from 'vitest';
import { DOC_STATUS_HINTS, EDM_STATE_HINTS, REQUEST_STATUS_HINTS } from './hints';
import { docStatusMeta, edmStateMeta, requestStatusMeta } from './status';

// the meta tables know exactly which values exist; a hint must exist for each of them
describe('signing hints', () => {
	it('every document status is explained', () => {
		for (const key of Object.keys(DOC_STATUS_HINTS)) expect(docStatusMeta(key).label, key).not.toBe(key);
		expect(Object.keys(DOC_STATUS_HINTS)).toHaveLength(8);
		for (const text of Object.values(DOC_STATUS_HINTS)) expect(text.length).toBeGreaterThan(10);
	});

	it('every signer status is explained', () => {
		for (const key of Object.keys(REQUEST_STATUS_HINTS)) expect(requestStatusMeta(key).label, key).not.toBe(key);
		expect(Object.keys(REQUEST_STATUS_HINTS)).toHaveLength(8);
		for (const text of Object.values(REQUEST_STATUS_HINTS)) expect(text.length).toBeGreaterThan(10);
	});

	it('every agreement state is explained', () => {
		for (const key of Object.keys(EDM_STATE_HINTS)) expect(edmStateMeta(key as keyof typeof EDM_STATE_HINTS).label).toBeTruthy();
		expect(Object.keys(EDM_STATE_HINTS).sort()).toEqual(['active', 'expired', 'revoked', 'upcoming']);
	});
});
