// Имена связанных сущностей для списков: имена организации и контакта в `DealOut`, номер и название сделки в `TaskOut` бэкенд отдаёт с 25.09 (backend-issues A-29), но списки пока догружают их по одной.
// Загрузка по одной, не более `max` запросов одновременно, результат кэшируется на сессию; недоступное (404/403) = null.
import { SvelteMap } from 'svelte/reactivity';
import { api, unwrap, ApiError } from '$lib/api';
import type { Contact, Organization } from '../types';

class EntityCache<T extends { id: string }> {
	/** undefined = не спрашивали · null = недоступно */
	#map = new SvelteMap<string, T | null>();
	#queue: string[] = [];
	#queued = new Set<string>();
	#active = 0;
	#fetch: (id: string) => Promise<T>;
	#max: number;

	constructor(fetcher: (id: string) => Promise<T>, max = 6) {
		this.#fetch = fetcher;
		this.#max = max;
	}

	get(id: string | null | undefined): T | null | undefined {
		return id ? this.#map.get(id) : undefined;
	}

	ensure(ids: (string | null | undefined)[]): void {
		for (const id of ids) {
			if (!id || this.#map.has(id) || this.#queued.has(id)) continue;
			this.#queued.add(id);
			this.#queue.push(id);
		}
		this.#pump();
	}

	put(item: T): void {
		this.#map.set(item.id, item);
	}

	#pump(): void {
		while (this.#active < this.#max && this.#queue.length) {
			const id = this.#queue.shift()!;
			this.#active += 1;
			void this.#fetch(id)
				.then((item) => this.#map.set(id, item))
				.catch((e: unknown) => {
					// сеть — повторим при следующем ensure, остальное — «недоступно»
					if (!(e instanceof ApiError && e.isNetwork)) this.#map.set(id, null);
				})
				.finally(() => {
					this.#queued.delete(id);
					this.#active -= 1;
					this.#pump();
				});
		}
	}
}

export const orgCache = new EntityCache<Organization>((id) =>
	unwrap(api.GET('/api/organizations/{organization_id}', { params: { path: { organization_id: id } } }))
);
export const contactCache = new EntityCache<Contact>((id) =>
	unwrap(api.GET('/api/contacts/{contact_id}', { params: { path: { contact_id: id } } }))
);

export const orgTitle = (o: Pick<Organization, 'name' | 'short_name'>): string => o.short_name || o.name;
export const contactFullName = (c: Pick<Contact, 'last_name' | 'first_name' | 'middle_name'>): string =>
	[c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ');

/** Название организации для строки списка: «…» пока грузится, «Недоступна» если нет прав. */
export function orgLabel(id: string | null | undefined): string {
	if (!id) return '';
	const org = orgCache.get(id);
	return org === undefined ? '…' : org ? orgTitle(org) : 'Организация недоступна';
}

export function contactLabel(id: string | null | undefined): string {
	if (!id) return '';
	const contact = contactCache.get(id);
	return contact === undefined ? '…' : contact ? contactFullName(contact) : 'Контакт недоступен';
}

// Сделки для подписей задач и уведомлений. `GET /deals/{id}` пишет сделку в «Недавние» пользователя, поэтому названия сначала
// добираем страницами списка (`GET /deals?limit=100`), а одиночный запрос — только для того, что в списки не попало.
import type { Deal } from '../types';

export const dealCache = new EntityCache<Deal>(async (id) => (await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: id } } }))).deal);

export async function preloadDeals(ids: (string | null | undefined)[]): Promise<void> {
	const want = new Set(ids.filter((id): id is string => !!id && dealCache.get(id) === undefined));
	if (!want.size) return;
	let cursor: string | undefined;
	for (let page = 0; page < 5 && want.size; page += 1) {
		const res = await unwrap(api.GET('/api/deals', { params: { query: { limit: 100, cursor } } }));
		for (const deal of res.items) {
			dealCache.put(deal);
			want.delete(deal.id);
		}
		if (!res.next_cursor) break;
		cursor = res.next_cursor;
	}
	dealCache.ensure([...want]);
}

export const dealLabel = (id: string | null | undefined): string => {
	const deal = id ? dealCache.get(id) : undefined;
	return deal === undefined ? '…' : deal ? `${deal.number} · ${deal.title}` : 'Сделка недоступна';
};
