import { describe, expect, it } from 'vitest';
import { directionOptions, productFitsDirection, withDescendants } from './directions';
import type { Direction } from '../types';

const d = (id: string, name: string, parent_id: string | null = null) => ({ id, name, parent_id, code: id, version: 1, created_at: '', updated_at: '' }) as Direction;
const tree = [d('py', 'Python', 'prog'), d('prog', 'Программирование'), d('sec', 'Безопасность'), d('java', 'Java', 'prog')];

describe('направления', () => {
	it('плоский список: корень, за ним его дети; у ребёнка в подсказке родитель', () => {
		expect(directionOptions(tree)).toEqual([
			{ key: 'sec', value: 'Безопасность', hint: undefined },
			{ key: 'prog', value: 'Программирование', hint: undefined },
			{ key: 'java', value: 'Java', hint: 'Программирование' },
			{ key: 'py', value: 'Python', hint: 'Программирование' }
		]);
	});
	it('осиротевшее направление и цикл в данных не ломают обход', () => {
		const odd = [d('a', 'A', 'ghost'), d('b', 'B', 'c'), d('c', 'C', 'b')];
		expect(directionOptions(odd).map((o) => o.key)).toEqual(['a']);
	});
	it('withDescendants берёт потомков на любую глубину', () => {
		const deep = [...tree, d('py3', 'Python 3', 'py')];
		expect([...withDescendants(deep, 'prog')].sort()).toEqual(['java', 'prog', 'py', 'py3']);
		expect([...withDescendants(deep, 'sec')]).toEqual(['sec']);
	});
	it('productFitsDirection: родитель включает детей, продукт без направления не подходит', () => {
		expect(productFitsDirection(tree, 'py', 'prog')).toBe(true);
		expect(productFitsDirection(tree, 'py', 'sec')).toBe(false);
		expect(productFitsDirection(tree, null, 'sec')).toBe(false);
		expect(productFitsDirection(tree, null, null)).toBe(true);
	});
});
