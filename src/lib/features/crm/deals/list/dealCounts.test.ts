import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DealQuery } from './dealFilters';

const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ api: { GET: get } }));

const { formatTabCount, loadTabCounts, tabQueries } = await import('./dealCounts');

const base: DealQuery = { organization_id: ['org-1'], status_id: ['a', 'b'], sort: '-amount' };
const queryOf = (call: unknown[]) => (call[1] as { params: { query: DealQuery & { limit?: number; cursor?: string } } }).params.query;

beforeEach(() => {
	get.mockReset();
});

describe('tabQueries', () => {
	it('шесть вкладок: общие фильтры сохраняются, быстрые разводят вкладки, сортировки нет', () => {
		const q = tabQueries(base, 'me-1');
		expect(Object.keys(q).sort()).toEqual(['all', 'breached', 'closed', 'mine', 'open', 'warning']);
		for (const v of Object.values(q)) {
			expect(v).toMatchObject({ organization_id: ['org-1'], status_id: ['a', 'b'] });
			expect(v!.sort).toBeUndefined();
		}
		expect(q.mine!.owner_id).toEqual(['me-1']);
		expect(q.warning!.sla_state).toBe('warning');
		expect(q.breached!.sla_state).toBe('breached');
		expect(q.closed!.is_closed).toBe(true);
		expect(q.open!.is_closed).toBe(false);
		expect(q.all!.sla_state).toBeUndefined();
	});
	it('вручную выбранный ответственный остаётся и во вкладке «Мои» (как в таблице)', () => {
		expect(tabQueries({ owner_id: ['other'] }, 'me-1').mine!.owner_id).toEqual(['other']);
	});
	it('быстрый фильтр базового запроса не просачивается в чужие вкладки', () => {
		const q = tabQueries({ sla_state: 'breached', is_closed: true }, 'me-1');
		expect(q.all!.sla_state).toBeUndefined();
		expect(q.all!.is_closed).toBeUndefined();
		expect(q.warning!.is_closed).toBeUndefined();
	});
	it('без meId вкладка «Мои» не запрашивается', () => {
		expect(tabQueries(base, undefined).mine).toBeUndefined();
	});
});

describe('loadTabCounts', () => {
	it('шесть запросов: у каждого limit=1 и нет cursor; берётся total', async () => {
		get.mockImplementation(async () => ({ data: { items: [], total: 7 } }));
		const counts = await loadTabCounts(tabQueries(base, 'me-1'));
		expect(get).toHaveBeenCalledTimes(6);
		for (const call of get.mock.calls) {
			expect(queryOf(call).limit).toBe(1);
			expect(queryOf(call).cursor).toBeUndefined();
		}
		expect(counts).toEqual({ all: 7, open: 7, mine: 7, warning: 7, breached: 7, closed: 7 });
	});
	it('без meId «Мои» не запрашивается и остаётся без числа', async () => {
		get.mockImplementation(async () => ({ data: { items: [], total: 3 } }));
		const counts = await loadTabCounts(tabQueries(base, undefined));
		expect(get).toHaveBeenCalledTimes(5);
		expect('mine' in counts).toBe(false);
	});
	it('отказ одного запроса не стирает остальные числа', async () => {
		get.mockImplementation(async (_u: string, o: { params: { query: DealQuery } }) => {
			if (o.params.query.sla_state === 'warning') throw new Error('boom');
			if (o.params.query.is_closed) return { data: undefined, error: { status: 500 } };
			return { data: { items: [], total: 2 } };
		});
		const counts = await loadTabCounts(tabQueries(base, 'me-1'));
		expect(counts).toEqual({ all: 2, open: 2, mine: 2, breached: 2 });
	});
	it('сигнал отмены передаётся в каждый запрос', async () => {
		get.mockImplementation(async () => ({ data: { items: [], total: 1 } }));
		const ctrl = new AbortController();
		await loadTabCounts(tabQueries(base, 'me-1'), ctrl.signal);
		for (const call of get.mock.calls) expect((call[1] as { signal: AbortSignal }).signal).toBe(ctrl.signal);
		ctrl.abort();
		expect((get.mock.calls[0][1] as { signal: AbortSignal }).signal.aborted).toBe(true);
	});
});

describe('formatTabCount', () => {
	it('9999 остаётся числом, 10000 — «10k+», неизвестное — undefined (вкладка без числа, не «0»)', () => {
		expect(formatTabCount(9999)).toBe('9999');
		expect(formatTabCount(10000)).toBe('10k+');
		expect(formatTabCount(0)).toBe('0');
		expect(formatTabCount(undefined)).toBeUndefined();
	});
});
