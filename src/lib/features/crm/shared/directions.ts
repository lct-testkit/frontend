// Справочник ИТ-направлений иерархический (`parent_id`): «Разработка ПО» → «Python», «Java». Чистые функции для выбора и фильтрации.
import type { Direction } from '../types';

export interface DirectionOption {
	key: string;
	value: string;
	/** название родителя у вложенного направления */
	hint?: string;
}

/** Обход дерева в глубину: корни по названию, под каждым — его дети. Осиротевшие (родитель не пришёл) считаются корнями. */
export function directionOptions(list: readonly Direction[]): DirectionOption[] {
	const ids = new Set(list.map((d) => d.id));
	const byName = (a: Direction, b: Direction) => a.name.localeCompare(b.name, 'ru');
	const children = new Map<string | null, Direction[]>();
	for (const d of list) {
		const parent = d.parent_id && ids.has(d.parent_id) ? d.parent_id : null;
		(children.get(parent) ?? children.set(parent, []).get(parent)!).push(d);
	}
	const out: DirectionOption[] = [];
	const seen = new Set<string>();
	const walk = (parent: string | null, parentName?: string) => {
		for (const d of (children.get(parent) ?? []).sort(byName)) {
			if (seen.has(d.id)) continue; // защита от цикла в данных
			seen.add(d.id);
			out.push({ key: d.id, value: d.name, hint: parentName });
			walk(d.id, d.name);
		}
	};
	walk(null);
	return out;
}

/** Направление и все его потомки: бэкенд при фильтре по направлению включает дочерние, интерфейс сужает список продуктов так же. */
export function withDescendants(list: readonly Direction[], id: string): Set<string> {
	const result = new Set<string>([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const d of list) {
			if (d.parent_id && result.has(d.parent_id) && !result.has(d.id)) {
				result.add(d.id);
				grew = true;
			}
		}
	}
	return result;
}

/** Подходит ли продукт под выбранное направление (учитывая вложенные). Без выбранного направления — подходит любой. */
export function productFitsDirection(list: readonly Direction[], productDirectionId: string | null | undefined, selected: string | null): boolean {
	if (!selected) return true;
	return !!productDirectionId && withDescendants(list, selected).has(productDirectionId);
}
