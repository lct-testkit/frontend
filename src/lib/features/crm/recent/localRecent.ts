// «Недавние» организации и контакты. Бэкенд помнит только сделки (`touch_recent` вызывается лишь для них — backend-issues A-25),
// поэтому карточки организаций и контактов дописывают себя в локальную историю браузера (10 записей на пользователя).
// В хранилище лежат только вид, id и время: названия и ФИО берутся из кэшей при показе, а при выходе история стирается.
import type { components } from '$lib/api/schema';

export type RemoteRecent = components['schemas']['RecentItemOut'];
export interface LocalRecent {
	type: string;
	id: string;
	opened_at: string;
}
/** Строка списка «Недавние»: `title` есть только у записей с бэкенда (сделки). */
export interface RecentRow extends LocalRecent {
	title?: string;
}

export const RECENT_KEY = 'rtk.crm.recent.v2';
/** Первая версия хранила и названия (ФИО контактов) — её стираем при первом чтении, не переносим. */
export const LEGACY_RECENT_KEY = 'rtk.crm.recent';
const MAX = 10;
export const KNOWN_TYPES = ['deal', 'organization', 'contact'] as const;

function read(): Record<string, LocalRecent[]> {
	try {
		localStorage.removeItem(LEGACY_RECENT_KEY);
		const raw = localStorage.getItem(RECENT_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, LocalRecent[]>) : {};
	} catch {
		return {};
	}
}

export function localRecent(userId: string | null | undefined): LocalRecent[] {
	const list = userId ? read()[userId] : undefined;
	return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && typeof r.type === 'string') : [];
}

export function pushRecent(userId: string | null | undefined, item: { type: string; id: string }): void {
	if (!userId) return;
	try {
		const all = read();
		const list = (all[userId] ?? []).filter((r) => !(r.type === item.type && r.id === item.id));
		list.unshift({ type: item.type, id: item.id, opened_at: new Date().toISOString() });
		all[userId] = list.slice(0, MAX);
		localStorage.setItem(RECENT_KEY, JSON.stringify(all));
	} catch {
		// хранилище недоступно (приватное окно) — история просто не запоминается
	}
}

/** Выход из системы и смена пользователя: история не остаётся на общем компьютере. */
export function clearRecent(): void {
	try {
		localStorage.removeItem(RECENT_KEY);
		localStorage.removeItem(LEGACY_RECENT_KEY);
	} catch {
		// нечего чистить
	}
}

/** Слияние истории бэкенда и браузера: без повторов по `type:id`, новые первыми, только известные виды, не больше `limit`. */
export function mergeRecent(remote: readonly RemoteRecent[], local: readonly LocalRecent[], limit: number): RecentRow[] {
	const known = new Set<string>(KNOWN_TYPES);
	const rows: RecentRow[] = [...remote, ...local].filter((r) => known.has(r.type) && Number.isFinite(Date.parse(r.opened_at)));
	rows.sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at));
	const seen = new Set<string>();
	const out: RecentRow[] = [];
	for (const r of rows) {
		const key = `${r.type}:${r.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
		if (out.length >= limit) break;
	}
	return out;
}
