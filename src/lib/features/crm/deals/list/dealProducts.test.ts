import { describe, expect, it } from 'vitest';
import { directionsLabel, hasProducts, productLine, productsLabel, productsTitle, type DealRow } from './dealProducts';

const prod = (name: string, direction?: [string, string]) => ({
	product_id: name,
	product_name: name,
	product_code: name,
	quantity: 1,
	direction_id: direction?.[0] ?? null,
	direction_name: direction?.[1] ?? null
});
const deal = (over: Partial<DealRow>) => ({ id: 'd', ...over }) as DealRow;

describe('продукты и направления в списке сделок', () => {
	it('два продукта одного направления: «Python +1» и одно направление', () => {
		const d = deal({ products: [prod('Python', ['dev', 'Разработка']), prod('Django', ['dev', 'Разработка'])], products_total: 2, directions: [{ id: 'dev', name: 'Разработка' }, { id: 'dev', name: 'Разработка' }] });
		expect(productsLabel(d)).toBe('Python +1');
		expect(directionsLabel(d)).toBe('Разработка');
		expect(productsTitle(d)).toBe('Python, Django');
	});
	it('продукты двух направлений: «Python, Java»', () => {
		const d = deal({ products: [prod('A', ['p', 'Python']), prod('B', ['j', 'Java'])], products_total: 2, directions: [{ id: 'p', name: 'Python' }, { id: 'j', name: 'Java' }] });
		expect(directionsLabel(d)).toBe('Python, Java');
		expect(productLine(d)).toBe('A +1 · Python +1');
	});
	it('сервер прислал не все продукты (5 из 8): счётчик берётся из products_total, в подсказке «и ещё 3»', () => {
		const five = ['a', 'b', 'c', 'd', 'e'].map((n) => prod(n));
		const d = deal({ products: five, products_total: 8 });
		expect(productsLabel(d)).toBe('a +7');
		expect(productsTitle(d)).toBe('a, b, c, d, e и ещё 3');
	});
	it('пустой список и сделка без полей дают «—» и не падают', () => {
		expect(productsLabel(deal({ products: [], products_total: 0 }))).toBe('—');
		expect(directionsLabel(deal({ products: [], directions: [] }))).toBe('—');
		expect(productsLabel(deal({}))).toBe('—');
		expect(productLine(deal({}))).toBe('');
		expect(productsTitle(deal({}))).toBe('');
	});
	it('hasProducts: колонки включаются, только если сервер прислал поле products', () => {
		expect(hasProducts([deal({}), deal({ products: [] })])).toBe(true);
		expect(hasProducts([deal({})])).toBe(false);
		expect(hasProducts([])).toBe(false);
	});
});
