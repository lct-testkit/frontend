// Подпись записи CRM в журналах интеграций: номер и название сделки, название организации, ФИО контакта вместо последних символов UUID.
import { contactCache, contactLabel, dealLabel, orgCache, orgLabel, preloadDeals } from '../../crm/shared/entityCache.svelte';

const NAMES: Record<string, string> = { deal: 'Сделка', organization: 'Организация', contact: 'Контакт' };
export const entityTypeName = (type: string): string => NAMES[type] ?? type;

/** «D-1042 · Название сделки» или «Сделка · a1b2c3», если у записи нет понятной подписи (другой тип). */
export function entityText(type: string, id: string): string {
	if (type === 'deal') return dealLabel(id);
	if (type === 'organization') return orgLabel(id);
	if (type === 'contact') return contactLabel(id);
	return `${entityTypeName(type)} · ${id.slice(-6)}`;
}

/** Подгружает подписи для строк журнала (сделки — страницами списка, остальное — по одной записи). */
export function ensureEntities(rows: readonly { type: string; id: string }[]): void {
	const by = (t: string) => rows.filter((r) => r.type === t).map((r) => r.id);
	void preloadDeals(by('deal'));
	orgCache.ensure(by('organization'));
	contactCache.ensure(by('contact'));
}
