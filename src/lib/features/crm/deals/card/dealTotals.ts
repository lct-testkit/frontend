// Итоги по продуктам сделки. Сумма сделки вводится вручную и по продуктам не пересчитывается: если они расходятся, карточка это показывает (D-5).

interface Line {
	quantity: number;
	price?: string | null;
	discount_pct: string;
	total?: string | null;
}

/** итог строки: с бэкенда может прийти null (создано без `total`) — считаем сами: цена × количество − скидка */
export function lineTotal(p: Line): string | null {
	if (p.total !== null && p.total !== undefined) return p.total;
	if (p.price === null || p.price === undefined) return null;
	return String(Number(p.price) * p.quantity * (1 - Number(p.discount_pct || 0) / 100));
}

/** сумма строк; `null` — продуктов нет или хотя бы у одной нет цены (итог неизвестен, расхождение не утверждаем) */
function productsTotal(lines: readonly Line[]): number | null {
	if (!lines.length) return null;
	let sum = 0;
	for (const l of lines) {
		const t = lineTotal(l);
		if (t === null) return null;
		sum += Number(t);
	}
	return Number.isFinite(sum) ? sum : null;
}

/** итог по продуктам, если он расходится с суммой сделки (копейка допуск); иначе `null` — показывать нечего */
export function totalMismatch(amount: string | number | null | undefined, lines: readonly Line[]): number | null {
	const total = productsTotal(lines);
	if (total === null) return null;
	const sum = amount === null || amount === undefined || amount === '' ? 0 : Number(amount);
	return Math.abs(sum - total) >= 0.005 ? total : null;
}
