// Серверный поиск и разрешение подписей для полей общего блока отчёта: вузы, направления, продукты, сотрудники.
// Запросы уходят только при открытии списка и вводе текста (RemoteMultiPick), а не при показе формы.
import { api, unwrap } from '$lib/api';
import type { RemoteItem, RemotePage, RemoteSearch } from '$lib/ui/fields/remote-list.svelte';

export const PAGE_SIZE = 20;
/** у `GET /api/users/directory` курсора нет: за один раз приходит до 100 человек */
export const OWNERS_LIMIT = 100;

const orgTitle = (o: { name: string; short_name?: string | null }): string => o.short_name || o.name;

// --- вузы ------------------------------------------------------------------------------------

export const orgSearch: RemoteSearch = async (q, cursor): Promise<RemotePage> => {
	const page = await unwrap(api.GET('/api/organizations', { params: { query: { q: q || undefined, limit: PAGE_SIZE, cursor: cursor ?? undefined } } }));
	return {
		items: page.items.map((o) => ({ key: o.id, value: orgTitle(o), hint: o.inn ?? undefined })),
		next: page.next_cursor ?? null
	};
};

export async function orgResolve(ids: string[]): Promise<RemoteItem[]> {
	const found = await Promise.allSettled(ids.map((id) => unwrap(api.GET('/api/organizations/{organization_id}', { params: { path: { organization_id: id } } }))));
	return found.flatMap((r) => (r.status === 'fulfilled' ? [{ key: r.value.id, value: orgTitle(r.value), hint: r.value.inn ?? undefined }] : []));
}

// --- направления -----------------------------------------------------------------------------

export const directionSearch: RemoteSearch = async (q, cursor): Promise<RemotePage> => {
	const page = await unwrap(api.GET('/api/directions', { params: { query: { q: q || undefined, all: true, limit: PAGE_SIZE, cursor: cursor ?? undefined } } }));
	return { items: page.items.map((d) => ({ key: d.id, value: d.name })), next: page.next_cursor ?? null };
};

// --- продукты --------------------------------------------------------------------------------

export const productSearch: RemoteSearch = async (q, cursor): Promise<RemotePage> => {
	// архивные не отфильтровываем: в старых отчётах выбран мог быть уже отключённый продукт
	const page = await unwrap(api.GET('/api/products', { params: { query: { q: q || undefined, limit: PAGE_SIZE, cursor: cursor ?? undefined } } }));
	return {
		items: page.items.map((p) => ({ key: p.id, value: p.name, hint: [p.vendor_name, p.code].filter(Boolean).join(' · ') || undefined, direction_id: p.direction_id })),
		next: page.next_cursor ?? null
	};
};

/** У направлений и продуктов нет «получить по id»: ищем сохранённые id постранично (справочники небольшие). */
async function scanFor(ids: string[], load: (cursor: string | undefined) => Promise<{ items: RemoteItem[]; next: string | null }>, maxPages = 10): Promise<RemoteItem[]> {
	const want = new Set(ids);
	const found: RemoteItem[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < maxPages && want.size; i++) {
		const page = await load(cursor);
		for (const item of page.items) if (want.delete(item.key)) found.push(item);
		if (!page.next) break;
		cursor = page.next;
	}
	return found;
}

export const directionResolve = (ids: string[]): Promise<RemoteItem[]> =>
	scanFor(ids, async (cursor) => {
		const page = await unwrap(api.GET('/api/directions', { params: { query: { all: true, limit: 100, cursor } } }));
		return { items: page.items.map((d) => ({ key: d.id, value: d.name })), next: page.next_cursor ?? null };
	});

export const productResolve = (ids: string[]): Promise<RemoteItem[]> =>
	scanFor(ids, async (cursor) => {
		const page = await unwrap(api.GET('/api/products', { params: { query: { limit: 100, cursor } } }));
		return { items: page.items.map((p) => ({ key: p.id, value: p.name, direction_id: p.direction_id })), next: page.next_cursor ?? null };
	});

// --- ответственные (сотрудники) --------------------------------------------------------------

const personName = (p: { display_name?: string | null; full_name: string }): string => p.display_name || p.full_name;

export const ownerSearch: RemoteSearch = async (q): Promise<RemotePage> => {
	const res = await unwrap(api.GET('/api/users/directory', { params: { query: { q: q || undefined, limit: OWNERS_LIMIT } } }));
	return { items: res.items.map((p) => ({ key: p.id, value: personName(p) })), next: null };
};

export async function ownerResolve(ids: string[]): Promise<RemoteItem[]> {
	const res = await unwrap(api.GET('/api/users/directory', { params: { query: { ids: ids.slice(0, 200).join(',') } } }));
	return res.items.map((p) => ({ key: p.id, value: personName(p) }));
}
