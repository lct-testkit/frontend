import { describe, expect, it } from 'vitest';
import { PRIORITY_LABELS, REGISTRY_STATUS_LABELS, SIGNATURE_STATUS_LABELS, SLA_STATE_LABELS, STATUS_TYPE_LABELS } from './labels';
import {
	PRIORITY_HINTS,
	REGISTRY_STATUS_HINTS,
	SIGNATURE_STATUS_HINTS,
	SLA_STATE_HINTS,
	STATUS_TYPE_HINTS,
	priorityHint,
	registryStatusHint,
	signatureStatusHint,
	slaHint,
	statusTypeHint
} from './hints';

const domains: [string, Record<string, string>, Record<string, string>][] = [
	['priority', PRIORITY_LABELS, PRIORITY_HINTS],
	['sla', SLA_STATE_LABELS, SLA_STATE_HINTS],
	['status type', STATUS_TYPE_LABELS, STATUS_TYPE_HINTS],
	['signature', SIGNATURE_STATUS_LABELS, SIGNATURE_STATUS_HINTS],
	['registry', REGISTRY_STATUS_LABELS, REGISTRY_STATUS_HINTS]
];

describe('hints: every enum value is explained', () => {
	for (const [name, labels, hints] of domains) {
		it(name, () => {
			for (const key of Object.keys(labels)) expect(hints[key]?.trim().length, `${name}.${key}`).toBeGreaterThan(10);
			expect(Object.keys(hints).sort()).toEqual(Object.keys(labels).sort());
		});
	}
});

describe('lookups', () => {
	it('return undefined for unknown or empty keys', () => {
		expect(priorityHint('nope')).toBeUndefined();
		expect(statusTypeHint(null)).toBeUndefined();
		expect(signatureStatusHint('won')).toBeUndefined();
		expect(registryStatusHint(undefined)).toBeUndefined();
		expect(statusTypeHint('parked')).toContain('заморожена');
	});

	it('slaHint adds the short label and the due date', () => {
		expect(slaHint('breached', '25.09.2026, 10:00', '−5 ч')).toBe(`−5 ч. ${SLA_STATE_HINTS.breached} Срок: 25.09.2026, 10:00.`);
		expect(slaHint('ok')).toBe(SLA_STATE_HINTS.ok);
		expect(slaHint('none')).toBeUndefined();
	});
});
