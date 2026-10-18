// «Доступ к вузам»: сколько запросов ждут моего решения (счётчик у пункта меню).
// Ручка `GET /api/access-requests?box=inbox&status=pending` отдаёт только то, что человек вправе решить (владелец вуза, руководитель его
// команды, администратор), поэтому для остальных счётчик остаётся нулём. Опрос раз в минуту, пока вкладка видна — как у колокольчика.
import { api, unwrap } from '$lib/api';

const POLL_MS = 60_000;
/** Потолок страницы ответа: больше 100 ожидающих запросов отдельно не считаем */
const LIMIT = 100;

class AccessInbox {
	count = $state(0);
	#timer: ReturnType<typeof setInterval> | undefined;
	#onVisible = () => {
		if (document.visibilityState === 'visible') void this.refresh();
	};

	/** Начать опрос; вернуть отписку. */
	start(): () => void {
		void this.refresh();
		this.#timer = setInterval(() => document.visibilityState === 'visible' && void this.refresh(), POLL_MS);
		document.addEventListener('visibilitychange', this.#onVisible);
		return () => {
			clearInterval(this.#timer);
			document.removeEventListener('visibilitychange', this.#onVisible);
		};
	}

	async refresh(): Promise<void> {
		try {
			const page = await unwrap(api.GET('/api/access-requests', { params: { query: { box: 'inbox', status: 'pending', limit: LIMIT } } }));
			this.count = page.items.length;
		} catch {
			// счётчик — удобство, не ошибка: остаётся прежнее число
		}
	}
}

export const accessInbox = new AccessInbox();
