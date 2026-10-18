import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_PREFIX, CACHE_ROWS, TTL_MS, cacheKey, clearDashboardCache, readCache, writeCache } from './dashboard-cache';
import { fromReportData } from './table';
import { columnSum, tileValue } from './widgets';

/** Минимальный sessionStorage на словаре; `limit` — сколько ключей влезает (имитация квоты). */
function fakeStorage(limit = Infinity) {
	const map = new Map<string, string>();
	let failNext = 0;
	const storage = {
		get length() {
			return map.size;
		},
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => {
			if (failNext > 0 || (!map.has(k) && map.size >= limit)) {
				failNext = Math.max(0, failNext - 1);
				throw new DOMException('quota', 'QuotaExceededError');
			}
			map.set(k, v);
		},
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear()
	};
	return { storage, map, failTimes: (n: number) => (failNext = n) };
}

const big = (n: number) =>
	fromReportData({
		columns: ['Вуз', 'Сумма, ₽'],
		rows: Array.from({ length: n }, (_, i) => [`Вуз ${i}`, 1])
	});

let fake = fakeStorage();
beforeEach(() => {
	fake = fakeStorage();
	vi.stubGlobal('sessionStorage', fake.storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('кэш дашборда', () => {
	it('таблица из 1000 строк: в кэше 300, но число строк и сумма — по всем 1000', () => {
		expect(writeCache('d1', 'k', { at: Date.now(), table: big(1000), jobId: 'job-1' })).toBe(true);
		const entry = readCache('d1', 'k');
		expect(entry?.table.rows).toHaveLength(CACHE_ROWS);
		expect(entry?.table.totalRows).toBe(1000);
		expect(entry?.jobId).toBe('job-1');
		expect(tileValue(entry!.table, 'rows')).toBe(1000);
		expect(columnSum(entry!.table, 'Сумма, ₽')).toBe(1000);
	});

	it('нехватка места: самая давняя запись удалена, запись повторена и прошла', () => {
		const small = fakeStorage(2);
		vi.stubGlobal('sessionStorage', small.storage);
		writeCache('d1', 'old', { at: 1_000, table: big(1) });
		writeCache('d1', 'mid', { at: 2_000, table: big(1) });
		expect(writeCache('d1', 'new', { at: 3_000, table: big(1) })).toBe(true);
		expect(small.map.has(cacheKey('d1', 'old'))).toBe(false);
		expect(small.map.has(cacheKey('d1', 'mid'))).toBe(true);
		expect(small.map.has(cacheKey('d1', 'new'))).toBe(true);
	});

	it('если убирать нечего — запись не падает, а возвращает false', () => {
		fake.failTimes(99);
		expect(writeCache('d1', 'k', { at: 1, table: big(1) })).toBe(false);
	});

	it('запись старше 5 минут и запись старого формата игнорируются, старый формат вычищается при нехватке места', () => {
		const now = 10_000_000;
		writeCache('d1', 'k', { at: now - TTL_MS - 1, table: big(1) });
		expect(readCache('d1', 'k', now)).toBeNull();
		fake.map.set('rtk.dash.d1.legacy', JSON.stringify({ at: now, table: { columns: [], rows: [] } }));
		expect(readCache('d1', 'legacy', now)).toBeNull();
		const small = fakeStorage(1);
		small.map.set('rtk.dash.d1.legacy', 'x');
		vi.stubGlobal('sessionStorage', small.storage);
		expect(writeCache('d1', 'k', { at: now, table: big(1) })).toBe(true);
		expect(small.map.has('rtk.dash.d1.legacy')).toBe(false);
	});

	it('sessionStorage бросает на чтении — null без исключения', () => {
		vi.stubGlobal('sessionStorage', {
			getItem: () => {
				throw new Error('denied');
			}
		});
		expect(readCache('d1', 'k')).toBeNull();
		vi.unstubAllGlobals();
		expect(readCache('d1', 'k')).toBeNull();
	});

	it('clearDashboardCache убирает только записи этого дашборда', () => {
		writeCache('d1', 'a', { at: Date.now(), table: big(1) });
		writeCache('d2', 'a', { at: Date.now(), table: big(1) });
		clearDashboardCache('d1');
		expect([...fake.map.keys()]).toEqual([`${CACHE_PREFIX}d2.a`]);
	});
});
