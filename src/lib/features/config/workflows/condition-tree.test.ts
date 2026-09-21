import { describe, expect, it } from 'vitest';
import { appendTo, depthOf, newLeaf, normalizeRoot, removeAt, replaceAt, setKind, toCondition, withField, withOperator } from './condition-tree';
import { DEFAULT_CATALOGUE, describeCondition, findField, type ConditionGroup } from './dsl';

const amount = findField('amount', DEFAULT_CATALOGUE);
const priority = findField('priority', DEFAULT_CATALOGUE);

describe('дерево условий', () => {
	it('пустое условие — пустая группа «все», и обратно в `{}`', () => {
		const root = normalizeRoot({});
		expect(root).toEqual({ all: [] });
		expect(toCondition(root)).toEqual({});
	});

	it('одиночное условие оборачивается в группу', () => {
		expect(normalizeRoot({ field: 'amount', op: 'not_null' })).toEqual({ all: [{ field: 'amount', op: 'not_null' }] });
	});

	it('добавление, правка, удаление и смена вида группы не мутируют исходное дерево', () => {
		const root: ConditionGroup = { all: [] };
		const one = appendTo(root, [], newLeaf(amount));
		expect(root).toEqual({ all: [] });
		const nested = appendTo(one, [], { any: [newLeaf(priority)] });
		expect(depthOf([1])).toBe(2);
		const changed = replaceAt(nested, [1, 0], { field: 'priority', op: 'eq', value: 'high' });
		expect(describeCondition(changed)).toBe('Сумма заполнено и Приоритет равно «Высокий»');
		expect(setKind(changed, [1], 'all')).toEqual({ all: [{ field: 'amount', op: 'not_null' }, { all: [{ field: 'priority', op: 'eq', value: 'high' }] }] });
		expect(removeAt(changed, [1, 0])).toEqual({ all: [{ field: 'amount', op: 'not_null' }, { any: [] }] });
	});

	it('смена поля сохраняет подходящий оператор, смена оператора приводит значение к нужному виду', () => {
		const leaf = { field: 'amount', op: 'gt' as const, value: 100 };
		expect(withField(leaf, findField('students_planned', DEFAULT_CATALOGUE))).toEqual({ field: 'students_planned', op: 'gt' });
		expect(withField(leaf, priority).op).toBe('eq');
		expect(withOperator(leaf, 'not_null')).toEqual({ field: 'amount', op: 'not_null' });
		expect(withOperator({ field: 'priority', op: 'eq', value: 'low' }, 'in')).toEqual({ field: 'priority', op: 'in', value: [] });
		expect(withOperator({ field: 'priority', op: 'in', value: ['low'] }, 'not_in')).toEqual({ field: 'priority', op: 'not_in', value: ['low'] });
	});
});
