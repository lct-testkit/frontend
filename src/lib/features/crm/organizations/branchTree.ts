// Филиалы и институты вуза: сервер отдаёт плоский список с parent_id, дерево собирает клиент.
import type { Branch } from '../types';

export interface BranchRow {
	branch: Branch;
	depth: number;
	/** число прямых дочерних */
	children: number;
}

/** Плоский список в порядке обхода дерева (родитель, затем его дети по названию). Строки с отсутствующим родителем считаются корневыми. */
export function branchRows(items: readonly Branch[]): BranchRow[] {
	const byParent = new Map<string | null, Branch[]>();
	const ids = new Set(items.map((b) => b.id));
	for (const b of items) {
		const key = b.parent_id && ids.has(b.parent_id) ? b.parent_id : null;
		byParent.set(key, [...(byParent.get(key) ?? []), b]);
	}
	for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
	const out: BranchRow[] = [];
	const seen = new Set<string>();
	const walk = (parent: string | null, depth: number) => {
		for (const branch of byParent.get(parent) ?? []) {
			if (seen.has(branch.id)) continue;
			seen.add(branch.id);
			out.push({ branch, depth, children: byParent.get(branch.id)?.length ?? 0 });
			walk(branch.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}

/** Сам филиал и все его потомки: их нельзя выбрать родителем (цикл — 422). */
function descendantIds(items: readonly Branch[], id: string): Set<string> {
	const out = new Set<string>([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const b of items) {
			if (b.parent_id && out.has(b.parent_id) && !out.has(b.id)) {
				out.add(b.id);
				grew = true;
			}
		}
	}
	return out;
}

/** Варианты родителя в форме: отступ по глубине, без самого филиала и его потомков. */
export function parentOptions(items: readonly Branch[], editingId: string | null): { key: string; value: string }[] {
	const banned = editingId ? descendantIds(items, editingId) : new Set<string>();
	return branchRows(items)
		.filter((r) => !banned.has(r.branch.id))
		.map((r) => ({ key: r.branch.id, value: `${'— '.repeat(r.depth)}${r.branch.name}` }));
}

export const BRANCH_LIMIT = 200;
