// Правки дерева условий перехода без мутаций: путь — индексы ветвей от корневой группы.
import {
	OPERATORS_BY_KIND,
	VALUELESS_OPERATORS,
	groupBranches,
	isEmptyCondition,
	isGroup,
	type Condition,
	type ConditionGroup,
	type ConditionLeaf,
	type ConditionNode,
	type FieldDef,
	type Operator
} from './dsl';

export type Path = number[];

export const groupOf = (kind: 'all' | 'any', branches: ConditionNode[]): ConditionGroup => (kind === 'all' ? { all: branches } : { any: branches });

/** Корень редактора всегда группа: пустое условие → пустая «все», одиночное условие → «все» из одного. */
export function normalizeRoot(value: Condition | undefined): ConditionGroup {
	if (isEmptyCondition(value)) return { all: [] };
	return isGroup(value) ? value : { all: [value as ConditionNode] };
}

/** Пустая корневая группа хранится как `{}` (так «без условий» понимает бэкенд). */
export function toCondition(root: ConditionGroup): Condition {
	return groupBranches(root).branches.length === 0 ? {} : root;
}

export function getAt(root: ConditionGroup, path: Path): ConditionNode | undefined {
	let node: ConditionNode = root;
	for (const i of path) {
		if (!isGroup(node)) return undefined;
		node = groupBranches(node).branches[i];
		if (node === undefined) return undefined;
	}
	return node;
}

function mapAt(node: ConditionNode, path: Path, fn: (n: ConditionNode) => ConditionNode | null): ConditionNode | null {
	if (path.length === 0) return fn(node);
	if (!isGroup(node)) return node;
	const { kind, branches } = groupBranches(node);
	const [head, ...rest] = path;
	const next = branches.flatMap((b, i) => {
		if (i !== head) return [b];
		const mapped = mapAt(b, rest, fn);
		return mapped === null ? [] : [mapped];
	});
	return groupOf(kind, next);
}

export function replaceAt(root: ConditionGroup, path: Path, node: ConditionNode): ConditionGroup {
	return mapAt(root, path, () => node) as ConditionGroup;
}

export function removeAt(root: ConditionGroup, path: Path): ConditionGroup {
	return path.length === 0 ? { all: [] } : (mapAt(root, path, () => null) as ConditionGroup);
}

export function appendTo(root: ConditionGroup, path: Path, node: ConditionNode): ConditionGroup {
	return mapAt(root, path, (g) => {
		if (!isGroup(g)) return g;
		const { kind, branches } = groupBranches(g);
		return groupOf(kind, [...branches, node]);
	}) as ConditionGroup;
}

export function setKind(root: ConditionGroup, path: Path, kind: 'all' | 'any'): ConditionGroup {
	return mapAt(root, path, (g) => (isGroup(g) ? groupOf(kind, groupBranches(g).branches) : g)) as ConditionGroup;
}

/** Глубина группы (корень = 1) — вложение ограничено `MAX_CONDITION_DEPTH`. */
export function depthOf(path: Path): number {
	return path.length + 1;
}

export function operatorsFor(field: FieldDef | undefined): Operator[] {
	return OPERATORS_BY_KIND[field?.kind ?? 'custom'];
}

/** Новое условие: первое поле каталога и его первый оператор. */
export function newLeaf(field: FieldDef | undefined): ConditionLeaf {
	const op = operatorsFor(field)[0] ?? 'not_null';
	return { field: field?.key ?? '', op };
}

/** Смена поля: оператор сохраняется, если подходит новому полю; значение сбрасывается. */
export function withField(leaf: ConditionLeaf, field: FieldDef | undefined): ConditionLeaf {
	const allowed = operatorsFor(field);
	const op = allowed.includes(leaf.op) ? leaf.op : (allowed[0] ?? 'not_null');
	return { field: field?.key ?? leaf.field, op };
}

/** Смена оператора: значение нужно ровно тогда, когда оператор его принимает; тип значения (список / одно) меняется вместе с оператором. */
export function withOperator(leaf: ConditionLeaf, op: Operator): ConditionLeaf {
	if (VALUELESS_OPERATORS.has(op)) return { field: leaf.field, op };
	const wasList = Array.isArray(leaf.value);
	const isList = op === 'in' || op === 'not_in';
	const value = wasList === isList ? leaf.value : undefined;
	return value === undefined ? { field: leaf.field, op, value: isList ? [] : '' } : { field: leaf.field, op, value };
}
