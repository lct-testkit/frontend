// Загрузка одного значения с отменой устаревших запросов: `const r = createResource((signal) => unwrap(api.GET(...)))`.
// `r.data` реактивно, `r.reload()` не сбрасывает данные (нет «прыжков» вёрстки), `r.loading` — только первая загрузка.

export class Resource<T> {
	data = $state<T | null>(null);
	/** первая загрузка (пока данных нет) */
	loading = $state(true);
	/** повторная загрузка поверх уже показанных данных */
	refreshing = $state(false);
	error = $state<unknown>(null);

	#load: (signal: AbortSignal) => Promise<T>;
	#ctrl: AbortController | null = null;
	#seq = 0;

	constructor(load: (signal: AbortSignal) => Promise<T>) {
		this.#load = load;
	}

	setLoader(load: (signal: AbortSignal) => Promise<T>): void {
		this.#load = load;
	}

	async reload(): Promise<T | null> {
		this.#ctrl?.abort();
		const ctrl = (this.#ctrl = new AbortController());
		const seq = ++this.#seq;
		if (this.data === null) this.loading = true;
		else this.refreshing = true;
		this.error = null;
		try {
			const value = await this.#load(ctrl.signal);
			if (seq !== this.#seq) return null;
			this.data = value;
			return value;
		} catch (e) {
			if (seq !== this.#seq || ctrl.signal.aborted) return null;
			this.error = e;
			return null;
		} finally {
			if (seq === this.#seq) {
				this.loading = false;
				this.refreshing = false;
			}
		}
	}

	/** Локальная правка без запроса (после успешного PATCH). */
	set(value: T | null): void {
		this.data = value;
	}

	abort(): void {
		this.#ctrl?.abort();
		this.#seq++;
	}
}

export function createResource<T>(load: (signal: AbortSignal) => Promise<T>): Resource<T> {
	return new Resource(load);
}
