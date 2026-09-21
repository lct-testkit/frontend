// Иерархия направлений: дерево, плоский список с отступами, потомки (для выбора родителя без циклов), путь «А › Б».
import { api, unwrap } from '$lib/api';
import type { Direction } from '../types';

export interface DirNode {
	id: string;
	code: string;
	name: string;
	parent_id: string | null;
	version: number;
	children: DirNode[];
}

/** Все направления: бэкенд отдаёт страницами по ≤ 100 (backend-issues #12), дереву нужен полный список. */
export async function fetchAllDirections(signal?: AbortSignal): Promise<Direction[]> {
	const all: Direction[] = [];
	let cursor: string | null = null;
	do {
		const page: { items: Direction[]; next_cursor?: string | null } = await unwrap(
			api.GET('/api/directions', { params: { query: { limit: 100, cursor } }, signal })
		);
		all.push(...page.items);
		cursor = page.next_cursor ?? null;
	} while (cursor);
	return all;
}

export function buildForest(items: readonly Direction[]): DirNode[] {
	const nodes = new Map<string, DirNode>(items.map((d) => [d.id, { id: d.id, code: d.code, name: d.name, parent_id: d.parent_id ?? null, version: d.version, children: [] }]));
	const roots: DirNode[] = [];
	for (const node of nodes.values()) {
		const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
		(parent ? parent.children : roots).push(node);
	}
	const sort = (list: DirNode[]) => {
		list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
		for (const n of list) sort(n.children);
	};
	sort(roots);
	return roots;
}

export interface FlatDirection {
	node: DirNode;
	depth: number;
}
export function flatten(nodes: readonly DirNode[], depth = 0): FlatDirection[] {
	return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

/** id самого направления и всех его потомков — их нельзя выбрать родителем (бэкенд циклы не проверяет, backend-issues #10). */
export function selfAndDescendants(items: readonly Direction[], id: string): Set<string> {
	const result = new Set<string>([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const d of items) {
			if (d.parent_id && result.has(d.parent_id) && !result.has(d.id)) {
				result.add(d.id);
				grew = true;
			}
		}
	}
	return result;
}

/** Пункты выбора с отступом по глубине: «Программирование», «  Python». */
export function directionOptions(items: readonly Direction[], exclude?: ReadonlySet<string>): { key: string; value: string }[] {
	return flatten(buildForest(items))
		.filter(({ node }) => !exclude?.has(node.id))
		.map(({ node, depth }) => ({ key: node.id, value: `${' '.repeat(depth)}${node.name}` }));
}

/** «Программирование › Python» */
export function directionPath(items: readonly Direction[], id: string | null | undefined): string {
	if (!id) return '';
	const byId = new Map(items.map((d) => [d.id, d]));
	const parts: string[] = [];
	const seen = new Set<string>();
	for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
		seen.add(cur.id);
		parts.unshift(cur.name);
	}
	return parts.join(' › ');
}
