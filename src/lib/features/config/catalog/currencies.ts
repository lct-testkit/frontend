// Валюты продукта: список для выбора вместо свободного текста (бэкенд принимает любой трёхбуквенный код — `ProductCreate.currency`,
// перечисления валют в нём нет; по умолчанию RUB). Незнакомая валюта уже сохранённого продукта остаётся в списке.
import type { PickItem } from '$lib/ui/fields/Pick.svelte';

export const DEFAULT_CURRENCY = 'RUB';

const CURRENCIES: readonly { code: string; name: string }[] = [
	{ code: 'RUB', name: 'рубль' },
	{ code: 'USD', name: 'доллар' },
	{ code: 'EUR', name: 'евро' },
	{ code: 'CNY', name: 'юань' }
];

export function currencyItems(current?: string | null): PickItem[] {
	const items = CURRENCIES.map((c) => ({ key: c.code, value: `${c.code} — ${c.name}` }));
	const code = (current ?? '').toUpperCase();
	return code && !CURRENCIES.some((c) => c.code === code) ? [{ key: code, value: code }, ...items] : items;
}
