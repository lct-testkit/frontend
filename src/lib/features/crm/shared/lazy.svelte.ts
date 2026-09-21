// Ленивый общий кэш справочника: один запрос на сессию, значение реактивно.
// `ensure()` вызывают из onMount / $effect / обработчиков, но не из шаблона (внутри запись в $state).
export class Lazy<T> {
	value = $state<T | undefined>(undefined);
	error = $state<unknown>(null);
	loading = $state(false);

	#load: () => Promise<T>;
	#promise: Promise<T> | null = null;

	constructor(load: () => Promise<T>) {
		this.#load = load;
	}

	ensure(): Promise<T> {
		if (!this.#promise) {
			this.loading = true;
			this.#promise = this.#load()
				.then((v) => {
					this.value = v;
					this.error = null;
					return v;
				})
				.catch((e: unknown) => {
					this.error = e;
					this.#promise = null;
					throw e;
				})
				.finally(() => {
					this.loading = false;
				});
		}
		return this.#promise;
	}

	reset(): void {
		this.#promise = null;
		this.value = undefined;
	}
}
