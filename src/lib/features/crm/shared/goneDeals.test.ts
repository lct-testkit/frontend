import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = () => import('./goneDeals');

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

describe('goneDeals', () => {
	it('markGone запоминает id, isGone читает его после перезагрузки модуля', async () => {
		const store = stubStorage();
		const a = await load();
		expect(a.isGone('d1')).toBe(false);
		a.markGone('d1');
		expect(a.isGone('d1')).toBe(true);
		expect(JSON.parse(store.get('rtk.crm.gone-deals')!)).toEqual(['d1']);

		vi.resetModules();
		const b = await load();
		expect(b.isGone('d1')).toBe(true);
		expect(b.isGone('d2')).toBe(false);
	});

	it('clearGone стирает и память, и хранилище', async () => {
		const store = stubStorage({ 'rtk.crm.gone-deals': '["d1"]' });
		const m = await load();
		expect(m.isGone('d1')).toBe(true);
		m.clearGone();
		expect(m.isGone('d1')).toBe(false);
		expect(store.has('rtk.crm.gone-deals')).toBe(false);
	});

	it('хранит не больше 500 последних', async () => {
		const store = stubStorage();
		const m = await load();
		for (let i = 0; i < 520; i += 1) m.markGone(`d${i}`);
		const saved = JSON.parse(store.get('rtk.crm.gone-deals')!) as string[];
		expect(saved).toHaveLength(500);
		expect(saved[0]).toBe('d20');
	});

	it('без sessionStorage (приватное окно) работает на памяти модуля и не бросает', async () => {
		vi.stubGlobal('sessionStorage', {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {
				throw new Error('denied');
			}
		});
		const m = await load();
		expect(() => m.markGone('d1')).not.toThrow();
		expect(m.isGone('d1')).toBe(true);
		expect(() => m.clearGone()).not.toThrow();
		expect(m.isGone('d1')).toBe(false);
	});
});
