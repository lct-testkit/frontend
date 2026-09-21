// Уведомления пользователя для колокольчика: счётчик и последние непрочитанные. У бэкенда нет счётчика непрочитанных
// (backend-issues A-24), поэтому берём до 100 непрочитанных и показываем «99+». Опрос раз в минуту, пока вкладка видна.
import { api, unwrap } from '$lib/api';
import type { NotificationItem } from '../types';
import { eventCodeInfo } from './eventCodes';

const LIMIT = 100;
const POLL_MS = 60_000;

class NotificationsStore {
	items = $state<NotificationItem[]>([]);
	loading = $state(false);
	loaded = $state(false);
	error = $state<unknown>(null);
	/** непрочитанных больше, чем мы загрузили */
	more = $state(false);

	#timer: ReturnType<typeof setInterval> | undefined;
	#users = 0;
	#onVisible = () => {
		if (document.visibilityState === 'visible') void this.refresh();
	};

	get unread(): number {
		return this.items.length;
	}
	get badge(): string {
		return this.unread === 0 ? '' : this.more || this.unread > 99 ? '99+' : String(this.unread);
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
			const page = await unwrap(api.GET('/api/notifications', { params: { query: { is_read: false, limit: LIMIT } } }));
			this.items = page.items;
			this.more = !!page.next_cursor;
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
		try {
			await unwrap(api.POST('/api/notifications/read', { body: { ids } }));
		} catch {
			void this.refresh();
		}
	}

	async markAll(): Promise<void> {
		this.items = [];
		this.more = false;
		try {
			await unwrap(api.POST('/api/notifications/read', { body: {} }));
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
