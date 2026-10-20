// Общий поиск верхней панели: одна ручка `GET /api/search` вместо трёх списков. Бэкенд сам повторяет поиск в другой раскладке, когда по набранному пусто.
import type { components } from '$lib/api/schema';

type SearchResponse = components['schemas']['SearchResponse'];

export interface SearchRow {
	id: string;
	href: string;
	primary: string;
	secondary?: string;
}
export interface SearchGroup {
	key: 'deals' | 'orgs' | 'contacts';
	title: string;
	rows: SearchRow[];
}

/** Самая длинная строка, которую принимает ручка (`q` ≤ 200). */
const SEARCH_MAX = 200;
const SEARCH_MIN = 2;

/** Строка запроса для ручки: без пробелов по краям и не длиннее допустимого; `null` — искать рано. */
export function searchText(raw: string): string | null {
	const text = raw.trim().slice(0, SEARCH_MAX).trim();
	return text.length >= SEARCH_MIN ? text : null;
}

/** Группы выпадающего списка: пустые не показываются. */
export function searchGroups(res: Pick<SearchResponse, 'deals' | 'organizations' | 'contacts'>): SearchGroup[] {
	const groups: SearchGroup[] = [
		{ key: 'deals', title: 'Сделки', rows: res.deals.map((d) => ({ id: d.id, href: `/deals/${d.id}`, primary: d.title, secondary: d.number })) },
		{
			key: 'orgs',
			title: 'Организации',
			rows: res.organizations.map((o) => ({ id: o.id, href: `/organizations/${o.id}`, primary: o.short_name || o.name, secondary: o.inn ? `ИНН ${o.inn}` : undefined }))
		},
		{
			key: 'contacts',
			title: 'Контакты',
			rows: res.contacts.map((c) => ({ id: c.id, href: `/contacts/${c.id}`, primary: [c.last_name, c.first_name].filter(Boolean).join(' '), secondary: c.position ?? undefined }))
		}
	];
	return groups.filter((g) => g.rows.length > 0);
}

/** «Показаны результаты для «ппу»» — только когда бэкенд поискал в другой раскладке. */
export function correctedNote(corrected: string | null | undefined): string | null {
	return corrected ? `Показаны результаты для «${corrected}»` : null;
}
