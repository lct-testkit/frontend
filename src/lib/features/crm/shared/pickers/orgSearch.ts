// Поиск вузов для выбора. Несколько выборов на одной странице (фильтр и панель) при появлении спрашивают одно и то же («первые 20 без запроса»):
// пока запрос идёт и ещё 10 секунд после ответа он общий, второго не будет. Запросы с текстом поиска всегда свежие.
import { api, unwrap } from '$lib/api';
import { orgCache, orgTitle } from '../entityCache.svelte';
import type { RemoteItem } from '$lib/ui/fields/RemotePick.svelte';

const inFlight = new Map<string, Promise<RemoteItem[]>>();
const RECENT_MS = 10_000;
let recent: { at: number; items: RemoteItem[] } | null = null;

export function searchOrganizations(query: string): Promise<RemoteItem[]> {
	const q = query.trim();
	if (q === '' && recent && Date.now() - recent.at < RECENT_MS) return Promise.resolve(recent.items);
	const running = inFlight.get(q);
	if (running) return running;
	const p = unwrap(api.GET('/api/organizations', { params: { query: { q: q || undefined, limit: 20 } } }))
		.then((page) => {
			for (const org of page.items) orgCache.put(org);
			const items = page.items.map((o) => ({ key: o.id, value: orgTitle(o), hint: o.inn ?? undefined }));
			if (q === '') recent = { at: Date.now(), items };
			return items;
		})
		.finally(() => inFlight.delete(q));
	inFlight.set(q, p);
	return p;
}
