// Опрос фоновой задачи (импорт, отчёт, реестр, перенос сделок): SSE и процентов прогресса у бэкенда нет.
// `tick` возвращает true — продолжать, false — остановиться. Ошибка сети не прерывает опрос (до `maxErrors` подряд).

export interface PollerOptions {
	/** мс между запросами */
	interval?: number;
	maxErrors?: number;
	/** приостанавливать, пока вкладка скрыта */
	pauseHidden?: boolean;
}

export class Poller {
	running = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;
	#errors = 0;
	#tick: () => Promise<boolean>;
	#opts: Required<PollerOptions>;

	constructor(tick: () => Promise<boolean>, opts: PollerOptions = {}) {
		this.#tick = tick;
		this.#opts = { interval: opts.interval ?? 2000, maxErrors: opts.maxErrors ?? 5, pauseHidden: opts.pauseHidden ?? true };
	}

	start(immediately = false): void {
		if (this.running) return;
		this.running = true;
		this.#errors = 0;
		this.#schedule(immediately ? 0 : this.#opts.interval);
	}

	stop(): void {
		this.running = false;
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	#schedule(delay: number): void {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.#run(), delay);
	}

	async #run(): Promise<void> {
		if (!this.running) return;
		if (this.#opts.pauseHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
			this.#schedule(this.#opts.interval);
			return;
		}
		try {
			const again = await this.#tick();
			this.#errors = 0;
			if (!again) return this.stop();
		} catch {
			if (++this.#errors >= this.#opts.maxErrors) return this.stop();
		}
		if (this.running) this.#schedule(this.#opts.interval);
	}
}

export function createPoller(tick: () => Promise<boolean>, opts?: PollerOptions): Poller {
	return new Poller(tick, opts);
}
