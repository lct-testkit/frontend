// «Недавние» организации и контакты. Бэкенд помнит только сделки (`touch_recent` вызывается лишь для них — backend-issues A-25),
// поэтому карточки организаций и контактов дописывают себя в локальную историю браузера (10 записей на пользователя).
import type { RecentItem } from '../types';

const KEY = 'rtk.crm.recent';
const MAX = 10;

function read(): Record<string, RecentItem[]> {
	try {
		const raw = localStorage.getItem(KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, RecentItem[]>) : {};
	} catch {
		return {};
	}
}

export function localRecent(userId: string | null | undefined): RecentItem[] {
	return userId ? (read()[userId] ?? []) : [];
}

export function pushRecent(userId: string | null | undefined, item: Omit<RecentItem, 'opened_at'>): void {
	if (!userId) return;
	try {
		const all = read();
		const list = (all[userId] ?? []).filter((r) => !(r.type === item.type && r.id === item.id));
		list.unshift({ ...item, opened_at: new Date().toISOString() });
		all[userId] = list.slice(0, MAX);
		localStorage.setItem(KEY, JSON.stringify(all));
	} catch {
		// хранилище недоступно (приватное окно) — история просто не запоминается
	}
}
