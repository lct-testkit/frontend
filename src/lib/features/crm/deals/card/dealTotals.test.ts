import { describe, expect, it } from 'vitest';
import { lineTotal, productsTotal, totalMismatch } from './dealTotals';

const line = (quantity: number, price: string | null, discount_pct = '0', total: string | null = null) => ({ quantity, price, discount_pct, total });

describe('dealTotals', () => {
	it('итог строки: свой total, иначе цена × кол-во − скидка', () => {
		expect(lineTotal(line(2, '100', '0', '150'))).toBe('150');
		expect(Number(lineTotal(line(8, '4500', '10')))).toBeCloseTo(32400);
		expect(lineTotal(line(1, null))).toBeNull();
	});
	it('сумма строк; без продуктов или без цены — null', () => {
		expect(productsTotal([])).toBeNull();
		expect(productsTotal([line(1, '10'), line(2, '5')])).toBe(20);
		expect(productsTotal([line(1, '10'), line(2, null)])).toBeNull();
	});
	it('расхождение: D-2026-000004 — 2 100 000 против 32 400', () => {
		expect(totalMismatch('2100000.00', [line(8, '4500', '10')])).toBeCloseTo(32400);
	});
	it('совпало (с учётом копейки) или продуктов нет — показывать нечего', () => {
		expect(totalMismatch('20.00', [line(1, '10'), line(2, '5')])).toBeNull();
		expect(totalMismatch('20.004', [line(1, '10'), line(2, '5')])).toBeNull();
		expect(totalMismatch('20', [])).toBeNull();
	});
	it('сумма не задана, а продукты есть — это тоже расхождение', () => {
		expect(totalMismatch(null, [line(1, '10')])).toBe(10);
	});
});
