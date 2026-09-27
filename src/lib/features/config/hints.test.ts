import { describe, expect, it } from 'vitest';
import { DEAL_TYPE_HINTS, INBOUND_STATUS_HINTS, OUTBOX_STATUS_HINTS, REGISTRY_VERSION_HINTS, WORKFLOW_STATE_HINTS, inboundHint, outboxHint, registryVersionHint } from './hints';
import { INBOUND_STATUSES, OUTBOX_STATUSES, REGISTRY_STATUSES } from './labels';
import { DEAL_TYPE_LABELS, WORKFLOW_STATE_LABELS } from './workflows/graph';

const keys = (o: readonly { key: string }[]) => o.map((x) => x.key).sort();

describe('config hints: every value is explained', () => {
	it('workflow states and deal types', () => {
		expect(Object.keys(WORKFLOW_STATE_HINTS).sort()).toEqual(Object.keys(WORKFLOW_STATE_LABELS).sort());
		expect(Object.keys(DEAL_TYPE_HINTS).sort()).toEqual(Object.keys(DEAL_TYPE_LABELS).sort());
	});
	it('outbox, inbound and registry statuses', () => {
		expect(Object.keys(OUTBOX_STATUS_HINTS).sort()).toEqual(keys(OUTBOX_STATUSES));
		expect(Object.keys(INBOUND_STATUS_HINTS).sort()).toEqual(keys(INBOUND_STATUSES));
		expect(Object.keys(REGISTRY_VERSION_HINTS).sort()).toEqual(keys(REGISTRY_STATUSES));
	});
	it('lookups', () => {
		expect(outboxHint('dead')).toContain('не доставлено');
		expect(outboxHint('?')).toBeUndefined();
		expect(registryVersionHint('failed')).toBeTruthy();
		expect(inboundHint('failed', 'bad sign')).toBe(`${INBOUND_STATUS_HINTS.failed} Ошибка: bad sign`);
		expect(inboundHint('nope', 'x')).toBeUndefined();
	});
});
