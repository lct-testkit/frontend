// Cursor pagination (`{ items, next_cursor }`, limit ≤ 100; OFFSET is never used by the backend).

export interface Page<T> {
	items: T[];
	next_cursor?: string | null;
	/** сколько всего подходит под фильтры, без учёта курсора — отдают не все ручки списков */
	total?: number;
}

export type PageLoader<T> = (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>;

export class Pager<T> {
	items = $state<T[]>([]);
	/** из последнего ответа; `undefined`, если ручка списка его не отдаёт */
	total = $state<number | undefined>(undefined);
	/** first page in flight (show skeleton) */
	loading = $state(false);
	/** next page in flight (show spinner under the list) */
	loadingMore = $state(false);
	error = $state<unknown>(null);
	hasMore = $state(false);
	/** true after the first page has arrived at least once */
	loaded = $state(false);

	#load: PageLoader<T>;
	#cursor: string | null = null;
	#ctrl: AbortController | null = null;
	#seq = 0;

	constructor(load: PageLoader<T>) {
		this.#load = load;
	}

	/** Replace the loader (e.g. filters changed) without recreating the pager. Call `reload()` afterwards. */
	setLoader(load: PageLoader<T>): void {
		this.#load = load;
	}

	get empty(): boolean {
		return this.loaded && !this.loading && this.items.length === 0 && !this.error;
	}

	async reload(): Promise<void> {
		this.#ctrl?.abort();
		const ctrl = (this.#ctrl = new AbortController());
		const seq = ++this.#seq;
		this.loading = true;
		this.loadingMore = false;
		this.error = null;
		this.#cursor = null;
		try {
			const page = await this.#load(null, ctrl.signal);
			if (seq !== this.#seq) return;
			this.items = page.items;
			this.total = page.total;
			this.#cursor = page.next_cursor ?? null;
			this.hasMore = this.#cursor !== null;
			this.loaded = true;
		} catch (e) {
			if (seq !== this.#seq || ctrl.signal.aborted) return;
			this.error = e;
			this.items = [];
			this.total = undefined;
			this.hasMore = false;
		} finally {
			if (seq === this.#seq) this.loading = false;
		}
	}

	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore || this.#cursor === null) return;
		const ctrl = this.#ctrl ?? (this.#ctrl = new AbortController());
		const seq = this.#seq;
		this.loadingMore = true;
		try {
			const page = await this.#load(this.#cursor, ctrl.signal);
			if (seq !== this.#seq) return;
			this.items = [...this.items, ...page.items];
			this.total = page.total;
			this.#cursor = page.next_cursor ?? null;
			this.hasMore = this.#cursor !== null;
		} catch (e) {
			if (seq !== this.#seq || ctrl.signal.aborted) return;
			this.error = e;
		} finally {
			if (seq === this.#seq) this.loadingMore = false;
		}
	}

	/** Patch one row in place after a successful mutation (no reload, no flicker). */
	patch(match: (row: T) => boolean, next: T | ((row: T) => T)): void {
		this.items = this.items.map((row) => (match(row) ? (typeof next === 'function' ? (next as (r: T) => T)(row) : next) : row));
	}

	remove(match: (row: T) => boolean): void {
		this.items = this.items.filter((row) => !match(row));
	}

	prepend(row: T): void {
		this.items = [row, ...this.items];
	}

	abort(): void {
		this.#ctrl?.abort();
		this.#seq++;
		this.loading = false;
		this.loadingMore = false;
	}
}

export function createPager<T>(load: PageLoader<T>): Pager<T> {
	return new Pager(load);
}
