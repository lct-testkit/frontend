// «Мне на подпись»: сколько запросов ждут подписи текущего пользователя (счётчик у пункта «Подписание» в меню).
// Ручка отдаёт список без пагинации, считаем открытые запросы (`sent`/`viewed`); опрос раз в минуту, пока вкладка видна.
import { api } from '$lib/api';
import { isRequestOpen } from './status';

const POLL_MS = 60_000;

class SignatureInbox {
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
			const { data } = await api.GET('/api/me/signature-requests');
			this.count = (data ?? []).filter((r) => isRequestOpen(r.status)).length;
		} catch {
			// счётчик — удобство, не ошибка: остаётся прежнее число
		}
	}
}

export const signatureInbox = new SignatureInbox();
