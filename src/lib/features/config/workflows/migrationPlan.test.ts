import { describe, expect, it } from 'vitest';
import { planOrder } from './migrationPlan';

const ids = (r: ReturnType<typeof planOrder>) => (r.ok ? r.order.map((x) => x.from) : r.error);

describe('planOrder', () => {
	it('цепочка A → B → C: сначала A, потом B (цель ещё не в архиве)', () => {
		expect(ids(planOrder([{ from: 'B', to: 'C' }, { from: 'A', to: 'B' }]))).toEqual(['A', 'B']);
	});
	it('цикл A → B → A — отказ', () => {
		expect(planOrder([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }]).ok).toBe(false);
	});
	it('начальный статус — отказ с подсказкой про шаг 1', () => {
		const r = planOrder([{ from: 'A', to: 'B', initial: true }]);
		expect(r.ok).toBe(false);
		expect(r.ok ? '' : r.error).toMatch(/шаг 1/);
	});
	it('одинаковые цели у нескольких статусов допустимы, порядок сохраняется', () => {
		expect(ids(planOrder([{ from: 'A', to: 'X' }, { from: 'B', to: 'X' }, { from: 'C', to: 'X' }]))).toEqual(['A', 'B', 'C']);
	});
	it('в себя или два раза один статус — отказ; пустой список — пустой порядок', () => {
		expect(planOrder([{ from: 'A', to: 'A' }]).ok).toBe(false);
		expect(planOrder([{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }]).ok).toBe(false);
		expect(ids(planOrder([]))).toEqual([]);
	});
	it('длинная цепочка из четырёх', () => {
		expect(ids(planOrder([{ from: 'C', to: 'D' }, { from: 'B', to: 'C' }, { from: 'A', to: 'B' }]))).toEqual(['A', 'B', 'C']);
	});
});
