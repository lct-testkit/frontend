// Уведомления пользователя для колокольчика: точный счётчик и короткий список последних непрочитанных для превью в панели.
// Счётчик — отдельной ручкой (`GET /notifications/unread-count`, без потолка страницы списка, backend-issues A-24), поэтому список
// для превью запрашивается ровно в размере, который реально показывается (`PREVIEW_LIMIT`), а не с запасом ради подсчёта «99+».
// Опрос раз в минуту, пока вкладка видна.
import { api, unwrap } from '$lib/api';
import type { NotificationItem } from '../types';
import { eventCodeInfo } from './eventCodes';

/** Столько показывает превью колокольчика (`NotificationBell`, `latest = items.slice(0, 10)`) */
const PREVIEW_LIMIT = 10;
const POLL_MS = 60_000;

class NotificationsStore {
	items = $state<NotificationItem[]>([]);
	unreadCount = $state(0);
	loading = $state(false);
	loaded = $state(false);
	error = $state<unknown>(null);

	#timer: ReturnType<typeof setInterval> | undefined;
	#users = 0;
	#onVisible = () => {
		if (document.visibilityState === 'visible') void this.refresh();
	};

	get unread(): number {
		return this.unreadCount;
	}
	get badge(): string {
		return this.unreadCount === 0 ? '' : String(this.unreadCount);
	}

	/** Подписаться на опрос (колокольчик при монтировании); вернуть отписку. */
	start(): () => void {
		this.#users += 1;
		if (this.#users === 1) {
			void this.refresh();
			this.#timer = setInterval(() => document.visibilityState === 'visible' && void this.refresh(), POLL_MS);
			document.addEventListener('visibilitychange', this.#onVisible);
		}
		return () => {
			this.#users -= 1;
			if (this.#users === 0) {
				clearInterval(this.#timer);
				document.removeEventListener('visibilitychange', this.#onVisible);
			}
		};
	}

	async refresh(): Promise<void> {
		this.loading = true;
		try {
			const [page, count] = await Promise.all([
				unwrap(api.GET('/api/notifications', { params: { query: { is_read: false, limit: PREVIEW_LIMIT } } })),
				unwrap(api.GET('/api/notifications/unread-count'))
			]);
			this.items = page.items;
			this.unreadCount = count.count;
			this.error = null;
			this.loaded = true;
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	async markRead(ids: string[]): Promise<void> {
		if (!ids.length) return;
		this.items = this.items.filter((n) => !ids.includes(n.id));
		this.unreadCount = Math.max(0, this.unreadCount - ids.length);
		try {
			await unwrap(api.POST('/api/notifications/read', { body: { ids } }));
		} catch {
			void this.refresh();
		}
	}

	/** Пустые `filters` — как раньше, все непрочитанные; с ними — только те, что видны под текущими фильтрами страницы (остальные
	 * непрочитанные остаются, поэтому счётчик колокольчика не обнуляется вслепую — он перечитывается с сервера). */
	async markAll(filters?: { priority?: string; entity_type?: string }): Promise<void> {
		const filtered = Boolean(filters?.priority || filters?.entity_type);
		if (!filtered) {
			this.items = [];
			this.unreadCount = 0;
		}
		try {
			const priority = filters?.priority as 'normal' | 'high' | 'critical' | undefined;
			await unwrap(api.POST('/api/notifications/read', { body: { priority, entity_type: filters?.entity_type } }));
			if (filtered) await this.refresh();
		} catch {
			void this.refresh();
		}
	}
}

export const notifications = new NotificationsStore();

/** Заголовок уведомления: отрендеренный `subject` или название события по коду. */
export const notificationTitle = (n: Pick<NotificationItem, 'subject' | 'template_code'>): string => n.subject || eventCodeInfo(n.template_code).label;

/** Текст: отрендеренный `body`; для кодов без шаблона — значения из `payload`. */
export function notificationBody(n: Pick<NotificationItem, 'body' | 'payload'>): string {
	if (n.body) return n.body;
	return Object.entries(n.payload ?? {})
		.slice(0, 3)
		.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
		.join(' · ');
}
