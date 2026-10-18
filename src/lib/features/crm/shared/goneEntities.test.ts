import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = () => import('./goneEntities');
const KEY = 'rtk.crm.gone';

function stubStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	vi.stubGlobal('sessionStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	});
	return store;
}

beforeEach(() => {
	vi.resetModules();
	vi.unstubAllGlobals();
});

describe('goneEntities', () => {
	it('markGone запоминает id, isGone читает его после перезагрузки модуля; виды не смешиваются', async () => {
		const store = stubStorage();
		const a = await load();
		expect(a.isGone('deal', 'd1')).toBe(false);
		a.markGone('deal', 'd1');
		a.markGone('organization', 'o1');
		expect(a.isGone('deal', 'd1')).toBe(true);
		expect(a.isGone('organization', 'd1')).toBe(false);
		expect(JSON.parse(store.get(KEY)!)).toEqual({ deal: ['d1'], organization: ['o1'], contact: [] });

		vi.resetModules();
		const b = await load();
		expect(b.isGone('deal', 'd1')).toBe(true);
		expect(b.isGone('organization', 'o1')).toBe(true);
		expect(b.isGone('contact', 'o1')).toBe(false);
	});

	it('clearGone стирает и память, и хранилище', async () => {
		const store = stubStorage({ [KEY]: '{"deal":["d1"]}' });
		const m = await load();
		expect(m.isGone('deal', 'd1')).toBe(true);
		m.clearGone();
		expect(m.isGone('deal', 'd1')).toBe(false);
		expect(store.has(KEY)).toBe(false);
	});

	it('хранит не больше 500 последних одного вида', async () => {
		const store = stubStorage();
		const m = await load();
		for (let i = 0; i < 520; i += 1) m.markGone('deal', `d${i}`);
		const saved = (JSON.parse(store.get(KEY)!) as { deal: string[] }).deal;
		expect(saved).toHaveLength(500);
		expect(saved[0]).toBe('d20');
	});

	it('испорченное содержимое хранилища не ломает чтение', async () => {
		stubStorage({ [KEY]: '{"deal":"oops","organization":[1,"o2"]}' });
		const m = await load();
		expect(m.isGone('organization', 'o2')).toBe(true);
		expect(m.isGone('deal', 'oops')).toBe(false);
	});

	it('без sessionStorage (приватное окно) работает на памяти модуля и не бросает', async () => {
		const denied = () => {
			throw new Error('denied');
		};
		vi.stubGlobal('sessionStorage', { getItem: denied, setItem: denied, removeItem: denied });
		const m = await load();
		expect(() => m.markGone('deal', 'd1')).not.toThrow();
		expect(m.isGone('deal', 'd1')).toBe(true);
		expect(() => m.clearGone()).not.toThrow();
		expect(m.isGone('deal', 'd1')).toBe(false);
	});
});
