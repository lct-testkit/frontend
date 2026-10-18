// Продукты и направления сделки для таблицы и доски. Бэкенд отдаёт их прямо в строке списка (`GET /api/deals`:
// `products` — не больше 5, `products_total` — сколько всего, `directions`), поэтому справочники на клиенте не нужны.
import type { Deal, DealListItem } from '../../types';

/** Строка списка: у `DealOut` из других ответов этих полей нет, тогда колонки не показываются. */
export type DealRow = Deal & Partial<Pick<DealListItem, 'products' | 'products_total' | 'directions' | 'status_name'>>;

export const EMPTY = '—';

/** Есть ли в ответе продукты (старый бэкенд или `DealOut` без них): по этому признаку включаются колонки. */
export const hasProducts = (rows: readonly DealRow[]): boolean => rows.some((r) => Array.isArray(r.products));

/** Сколько продуктов у сделки: учитывается и то, что в `products` пришло не больше 5. */
function total(deal: DealRow): number {
	return Math.max(deal.products_total ?? 0, deal.products?.length ?? 0);
}

/** Название первого продукта и сколько ещё: «+N» выводится отдельно, чтобы не пропадать при обрезке длинного названия. */
export function productParts(deal: DealRow): { first: string; more: number } {
	const first = deal.products?.[0];
	return first ? { first: first.product_name, more: Math.max(total(deal) - 1, 0) } : { first: EMPTY, more: 0 };
}

/** «Python», «Python +1» (первый продукт — с наибольшей суммой строки, порядок задаёт сервер), «—» без продуктов. */
export function productsLabel(deal: DealRow): string {
	const first = deal.products?.[0];
	if (!first) return EMPTY;
	const rest = total(deal) - 1;
	return rest > 0 ? `${first.product_name} +${rest}` : first.product_name;
}

/** Все названия для подсказки; если сервер прислал не все (больше 5) — «и ещё N». */
export function productsTitle(deal: DealRow): string {
	const names = (deal.products ?? []).map((p) => p.product_name);
	if (!names.length) return '';
	const hidden = total(deal) - names.length;
	return hidden > 0 ? `${names.join(', ')} и ещё ${hidden}` : names.join(', ');
}

/** Уникальные направления сделки по порядку появления. */
export function directionNames(deal: DealRow): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const d of deal.directions ?? []) {
		if (!seen.has(d.id)) {
			seen.add(d.id);
			out.push(d.name);
		}
	}
	return out;
}

/** «Python», «Python, Java», «—». */
export function directionsLabel(deal: DealRow): string {
	const names = directionNames(deal);
	return names.length ? names.join(', ') : EMPTY;
}

/** Строка карточки доски и телефона: «Python · Разработка ПО» или «Python +1 · …»; пустая, если у сделки нет продуктов. */
export function productLine(deal: DealRow): string {
	if (!deal.products?.length) return '';
	const dirs = directionNames(deal);
	return [productsLabel(deal), dirs.length ? (dirs.length > 1 ? `${dirs[0]} +${dirs.length - 1}` : dirs[0]) : ''].filter(Boolean).join(' · ');
}
