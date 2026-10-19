import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('uuid', () => {
	it('использует crypto.randomUUID, если он есть', () => {
		vi.stubGlobal('crypto', { randomUUID: () => 'fixed', getRandomValues: () => {} });
		expect(uuid()).toBe('fixed');
	});

	it('без randomUUID (небезопасный контекст) собирает валидный v4 из getRandomValues', () => {
		vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => (a.fill(0xff), a) });
		expect(uuid()).toMatch(V4);
		expect(uuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
	});

	it('значения различаются и проходят формат v4', () => {
		vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => (a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))), a) });
		const set = new Set(Array.from({ length: 200 }, uuid));
		expect(set.size).toBe(200);
		for (const v of set) expect(v).toMatch(V4);
	});

	it('даже без crypto не падает', () => {
		vi.stubGlobal('crypto', undefined);
		expect(uuid()).toMatch(V4);
	});
});
