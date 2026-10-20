// Предпросмотр числа строк до «Запустить»: форма спрашивает бэкенд (POST /api/reports/preview), когда пользователь перестал менять параметры.
// Предпросмотр — подсказка, а не часть запуска: ошибка, лимит частоты или долгий ответ его просто прячут, форма и «Запустить» работают как раньше.
import { ApiError } from '$lib/api';
import { previewReport } from './api';

export type PreviewPhase = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface PreviewOptions {
	/** пауза после последней правки параметров, мс */
	delay?: number;
	/** дольше этого ответ не ждём, мс: подсказка не стоит открытого запроса */
	timeout?: number;
	fetch?: typeof previewReport;
	now?: () => number;
}

const PREVIEW_DELAY_MS = 400;
const PREVIEW_TIMEOUT_MS = 10_000;
/** сколько ждать при лимите частоты, если сервер не назвал срок */
const FALLBACK_HOLD_MS = 5000;

export class ReportPreview {
	phase = $state<PreviewPhase>('idle');
	/** последнее полученное число; при новом запросе остаётся на экране (приглушённым), пока не придёт новое */
	rows = $state<number | null>(null);
	/** false — оценка тяжёлого отчёта: «≈ N» */
	exact = $state(true);
	#timer: ReturnType<typeof setTimeout> | undefined;
	#limit: ReturnType<typeof setTimeout> | undefined;
	#ctl: AbortController | null = null;
	/** код + параметры последнего запроса: тот же набор второй раз не спрашиваем */
	#key = '';
	#holdUntil = 0;
	readonly #delay: number;
	readonly #timeout: number;
	readonly #fetch: typeof previewReport;
	readonly #now: () => number;

	constructor(opts: PreviewOptions = {}) {
		this.#delay = opts.delay ?? PREVIEW_DELAY_MS;
		this.#timeout = opts.timeout ?? PREVIEW_TIMEOUT_MS;
		this.#fetch = opts.fetch ?? previewReport;
		this.#now = opts.now ?? Date.now;
	}

	/** Параметры изменились: через паузу спросить число строк. Тот же набор подряд — без нового запроса. */
	request(code: string, params: Record<string, unknown>): void {
		const key = JSON.stringify([code, params]);
		if (key === this.#key && this.phase !== 'idle') return;
		this.#cancel();
		this.#key = key;
		const wait = Math.max(this.#delay, this.#holdUntil - this.#now());
		// сервер попросил подождать (429): пока ждём, «Считаем…» не показываем — число не придёт
		this.phase = wait > this.#delay ? 'unavailable' : 'loading';
		this.#timer = setTimeout(() => void this.#send(code, params), wait);
	}

	/** Форма не в том состоянии, чтобы считать (ошибка в поле, отчёт идёт): число прячем и ничего не спрашиваем. */
	clear(): void {
		this.#cancel();
		this.#key = '';
		this.phase = 'idle';
		this.rows = null;
	}

	async #send(code: string, params: Record<string, unknown>): Promise<void> {
		const ctl = new AbortController();
		this.#ctl = ctl;
		this.#limit = setTimeout(() => ctl.abort(), this.#timeout);
		try {
			const r = await this.#fetch(code, params, ctl.signal);
			if (this.#ctl !== ctl) return; // пока ждали, параметры поменялись
			this.rows = r.row_count;
			this.exact = r.exact;
			this.phase = 'ready';
		} catch (e) {
			if (this.#ctl !== ctl) return;
			if (e instanceof ApiError && e.status === 429) this.#holdUntil = this.#now() + (e.retryAfter != null ? e.retryAfter * 1000 : FALLBACK_HOLD_MS);
			this.rows = null;
			this.phase = 'unavailable';
		} finally {
			if (this.#ctl === ctl) {
				clearTimeout(this.#limit);
				this.#ctl = null;
			}
		}
	}

	#cancel(): void {
		clearTimeout(this.#timer);
		clearTimeout(this.#limit);
		this.#ctl?.abort();
		this.#ctl = null;
	}

	destroy(): void {
		this.#cancel();
	}
}
