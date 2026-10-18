// Имена связанных сущностей для списков: имена организации и контакта в `DealOut`, номер и название сделки в `TaskOut` бэкенд отдаёт с 25.09 (backend-issues A-29), но списки пока догружают их по одной.
// Загрузка по одной, не более `max` запросов одновременно, результат кэшируется на сессию; недоступное (404/403) = null.
import { SvelteMap } from 'svelte/reactivity';
import { api, unwrap, ApiError } from '$lib/api';
import { session } from '$lib/auth/session.svelte';
import type { Contact, Organization } from '../types';
import { clearGone, isGone, markGone } from './goneDeals';

/** Сколько ждать перед повторной попыткой после 429 или 5xx (мс); сбой сети повторяется со следующим ensure. */
const RETRY_AFTER_MS = 15_000;
/** Сколько страниц списка сделок читать ради названий (100 на странице). */
const PRELOAD_PAGES = 5;

class EntityCache<T extends { id: string }> {
	/** undefined = не спрашивали · null = недоступно */
	#map = new SvelteMap<string, T | null>();
	#queue: string[] = [];
	#queued = new Set<string>();
	#active = 0;
	#fetch: (id: string) => Promise<T>;
	#max: number;
	/** id, чья загрузка упала временно (429, 5xx): когда можно пробовать снова */
	#retryAt = new Map<string, number>();
	/** известно заранее (например, удалённая сделка из прошлой загрузки страницы): запрос не нужен */
	#known: (id: string) => boolean;
	/** сервер ответил 404 */
	#onMissing: (id: string) => void;

	constructor(fetcher: (id: string) => Promise<T>, max = 6, hooks: { known?: (id: string) => boolean; onMissing?: (id: string) => void } = {}) {
		this.#fetch = fetcher;
		this.#max = max;
		this.#known = hooks.known ?? (() => false);
		this.#onMissing = hooks.onMissing ?? (() => {});
	}

	get(id: string | null | undefined): T | null | undefined {
		return id ? this.#map.get(id) : undefined;
	}

	ensure(ids: (string | null | undefined)[]): void {
		for (const id of ids) {
			if (!id || this.#map.has(id) || this.#queued.has(id)) continue;
			if (this.#known(id)) {
				this.#map.set(id, null);
				continue;
			}
			if ((this.#retryAt.get(id) ?? 0) > Date.now()) continue;
			this.#queued.add(id);
			this.#queue.push(id);
		}
		this.#pump();
	}

	put(item: T): void {
		this.#map.set(item.id, item);
	}

	/** Сущности нет (известно без запроса, например по полному списку): «недоступно» + запоминание через `onMissing`. */
	markMissing(id: string): void {
		this.#map.set(id, null);
		this.#onMissing(id);
	}

	#pump(): void {
		while (this.#active < this.#max && this.#queue.length) {
			const id = this.#queue.shift()!;
			this.#active += 1;
			void this.#fetch(id)
				.then((item) => {
					this.#retryAt.delete(id);
					this.#map.set(id, item);
				})
				.catch((e: unknown) => {
					// сеть, 429 и 5xx — временно: не запоминаем «недоступно», повторим позже; 404 и 403 — окончательно
					if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
						this.#map.set(id, null);
						if (e.status === 404) this.#onMissing(id);
					} else if (e instanceof ApiError && !e.isNetwork && e.status > 0 && e.status < 429) {
						this.#map.set(id, null);
					} else if (!(e instanceof ApiError && e.isNetwork)) {
						this.#retryAt.set(id, Date.now() + RETRY_AFTER_MS);
					}
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

// Удалённая сделка отвечает 404. Её id запоминается на вкладку (`goneDeals.ts`, sessionStorage): после перезагрузки страницы
// колокольчик и «Недавние» не спрашивают о ней снова, а показывают «Сделка удалена».
export const dealCache = new EntityCache<Deal>(
	async (id) => (await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: id } } }))).deal,
	6,
	{ known: isGone, onMissing: markGone }
);
session.onReset(clearGone);

/** Названия сделок для подписей. Сначала страницами списка (одиночный `GET /deals/{id}` пишет сделку в «Недавние»).
 * Если список прочитан до конца, а нужной сделки в нём нет — её удалили (или она вне доступа): запрос не нужен вовсе. */
export async function preloadDeals(ids: (string | null | undefined)[]): Promise<void> {
	const want = new Set(ids.filter((id): id is string => !!id && dealCache.get(id) === undefined));
	if (!want.size) return;
	let cursor: string | undefined;
	let complete = false;
	for (let page = 0; page < PRELOAD_PAGES && want.size; page += 1) {
		const res = await unwrap(api.GET('/api/deals', { params: { query: { limit: 100, cursor } } }));
		for (const deal of res.items) {
			dealCache.put(deal);
			want.delete(deal.id);
		}
		if (!res.next_cursor) {
			complete = true;
			break;
		}
		cursor = res.next_cursor;
	}
	if (complete) for (const id of want) dealCache.markMissing(id);
	else dealCache.ensure([...want]);
}

export const dealLabel = (id: string | null | undefined): string => {
	const deal = id ? dealCache.get(id) : undefined;
	if (!id) return '…';
	return deal === undefined ? '…' : deal ? `${deal.number} · ${deal.title}` : isGone(id) ? 'Сделка удалена' : 'Сделка недоступна';
};
