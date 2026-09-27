import { describe, expect, it } from 'vitest';
import { createDirtyTracker, TRUST_MS } from './form-dirty';

describe('createDirtyTracker', () => {
	it('is clean until the values change after a user action', () => {
		const t = createDirtyTracker();
		t.sample('', 0);
		expect(t.dirty).toBe(false);
		t.userAction(1000);
		t.sample('a', 1100);
		expect(t.dirty).toBe(true);
	});
	it('takes a change that comes by itself as the starting point', () => {
		const t = createDirtyTracker();
		t.sample('', 0);
		t.sample('loaded', 2000);
		expect(t.dirty).toBe(false);
		t.userAction(3000);
		t.sample('loaded!', 3100);
		expect(t.dirty).toBe(true);
	});
	it('ignores a click that opened the form followed by data loading within the trust window', () => {
		const t = createDirtyTracker(1000);
		t.userAction(950);
		t.sample('', 1000);
		t.sample('loaded', 1300);
		expect(t.dirty).toBe(false);
		t.userAction(1400);
		t.sample('loaded!', 1450);
		expect(t.dirty).toBe(true);
	});
	it('is clean again when the input is erased', () => {
		const t = createDirtyTracker();
		t.sample('x', 0);
		t.userAction(1000);
		t.sample('xy', 1100);
		t.userAction(1200);
		t.sample('x', 1300);
		expect(t.dirty).toBe(false);
	});
	it('keeps the input when a later sample repeats the same values', () => {
		const t = createDirtyTracker();
		t.sample('', 0);
		t.userAction(1000);
		t.sample('a', 1050);
		t.sample('a', 1050 + TRUST_MS * 3);
		expect(t.dirty).toBe(true);
	});
});
