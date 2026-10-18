import { describe, expect, it } from 'vitest';
import { COLUMN_PAGE, applyMove, emptyColumn, mergeItems, remaining, runLimited, withTotals, type BoardColumn } from './boardColumns';
import type { DealRow } from './dealProducts';

const deal = (id: string) => ({ id }) as DealRow;
const col = (ids: string[], total: number | null, cursor: string | null = null): BoardColumn => ({ ...emptyColumn(), items: ids.map(deal), total, cursor, loading: false });

describe('столбцы доски', () => {
	it('слияние страниц столбца не дублирует сделки по id', () => {
		expect(mergeItems([deal('a'), deal('b')], [deal('b'), deal('c')]).map((d) => d.id)).toEqual(['a', 'b', 'c']);
	});
	it('«Ещё N»: не больше страницы и не больше остатка; без курсора кнопки нет', () => {
		expect(remaining(col(Array(25).fill('x'), 600, 'next'))).toBe(COLUMN_PAGE);
		expect(remaining(col(['a', 'b', 'c'], 10, 'next'))).toBe(7);
		expect(remaining(col(['a'], 1, null))).toBe(0);
	});
	it('перенос карточки меняет оба счётчика на 1, карточка встаёт первой в целевом столбце', () => {
		const cols = { s1: col(['a', 'b'], 40, 'n'), s2: col(['c'], 5) };
		const moved = applyMove(cols, deal('a'), 's1', 's2');
		expect(moved.s1.total).toBe(39);
		expect(moved.s2.total).toBe(6);
		expect(moved.s1.items.map((d) => d.id)).toEqual(['b']);
		expect(moved.s2.items.map((d) => d.id)).toEqual(['a', 'c']);
		// исходное состояние не изменено — к нему можно вернуться при отказе
		expect(cols.s1.total).toBe(40);
		expect(applyMove(moved, deal('a'), 's2', 's1')).toMatchObject({ s1: { total: 40 }, s2: { total: 5 } });
	});
	it('свежие total с сервера перекрывают оптимистичные; неизвестные не трогают', () => {
		const cols = { s1: col([], 39), s2: col([], 6) };
		const next = withTotals(cols, { s1: 41, s2: undefined, ghost: 3 });
		expect(next.s1.total).toBe(41);
		expect(next.s2.total).toBe(6);
		expect('ghost' in next).toBe(false);
	});
	it('счётчик неизвестного столбца остаётся неизвестным (null), а не 0 или −1', () => {
		const moved = applyMove({ s1: col(['a'], null), s2: col([], null) }, deal('a'), 's1', 's2');
		expect(moved.s1.total).toBeNull();
		expect(moved.s2.total).toBeNull();
	});
});

describe('runLimited', () => {
	it('не больше limit задач одновременно, результаты по порядку', async () => {
		let active = 0;
		let peak = 0;
		const tasks = Array.from({ length: 17 }, (_, i) => async () => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 2));
			active -= 1;
			return i;
		});
		const out = await runLimited(tasks, 6);
		expect(peak).toBe(6);
		expect(out).toEqual(Array.from({ length: 17 }, (_, i) => i));
	});
});
