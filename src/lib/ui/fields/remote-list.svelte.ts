// Состояние серверного списка для полей выбора: запрос с задержкой, подгрузка следующей страницы, защита от гонок,
// словарь всего, что когда-либо приходило (по нему подписываются выбранные теги, даже если новый поиск их не вернул).
// Без DOM — тестируется в vitest `node`.
import { SvelteMap } from 'svelte/reactivity';
import { debounce } from '$lib/utils/debounce';

export interface RemoteItem {
	key: string;
	value: string;
	hint?: string;
	[extra: string]: unknown;
}

export interface RemotePage {
	items: RemoteItem[];
	/** курсор следующей страницы; `null` — страниц больше нет */
	next: string | null;
}

export type RemoteSearch = (query: string, cursor: string | null) => Promise<RemotePage>;

export class RemoteList {
	query = $state('');
	items = $state.raw<RemoteItem[]>([]);
	hasMore = $state(false);
	/** первая страница в пути */
	loading = $state(false);
	/** следующая страница в пути */
	loadingMore = $state(false);
	error = $state<unknown>(null);
	/** хотя бы один запрос уже уходил */
	started = $state(false);
	/** всё, что когда-либо приходило: по этому словарю строятся подписи выбранных */
	readonly known = new SvelteMap<string, RemoteItem>();

	#search: RemoteSearch;
	#cursor: string | null = null;
	#seq = 0;
	/** что повторит `retry()`: первую страницу или следующую */
	#failed: 'first' | 'more' | null = null;
	#later: ReturnType<typeof debounce<[]>>;

	constructor(search: RemoteSearch, wait = 250) {
		this.#search = search;
		this.#later = debounce(() => void this.#first(), wait);
	}

	/** Меняет запрос; поиск уходит через `wait` мс после последнего символа. */
	setQuery(q: string): void {
		if (q === this.query && this.started) return;
		this.query = q;
		this.#later();
	}

	/** Первый запрос при открытии списка; повторные открытия новых запросов не создают. */
	ensureLoaded(): void {
		if (!this.started) void this.#first();
	}

	async #first(): Promise<void> {
		this.#later.cancel();
		const mine = ++this.#seq;
		this.started = true;
		this.loading = true;
		this.loadingMore = false;
		this.error = null;
		this.#failed = null;
		this.#cursor = null;
		try {
			const page = await this.#search(this.query.trim(), null);
			if (mine !== this.#seq) return;
			this.#take(page, true);
		} catch (e) {
			if (mine !== this.#seq) return;
			this.error = e;
			this.#failed = 'first';
			this.items = [];
			this.hasMore = false;
		} finally {
			if (mine === this.#seq) this.loading = false;
		}
	}

	/** Дописывает следующую страницу; повторы по `key` отбрасываются. */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) return;
		const mine = ++this.#seq;
		this.loadingMore = true;
		this.error = null;
		this.#failed = null;
		try {
			const page = await this.#search(this.query.trim(), this.#cursor);
			if (mine !== this.#seq) return;
			this.#take(page, false);
		} catch (e) {
			if (mine !== this.#seq) return;
			this.error = e;
			this.#failed = 'more';
		} finally {
			if (mine === this.#seq) this.loadingMore = false;
		}
	}

	/** Повторяет то, что не удалось. */
	async retry(): Promise<void> {
		if (this.#failed === 'more') return this.loadMore();
		return this.#first();
	}

	#take(page: RemotePage, replace: boolean): void {
		for (const item of page.items) this.known.set(item.key, item);
		if (replace) this.items = page.items.filter((item, i, all) => all.findIndex((x) => x.key === item.key) === i);
		else {
			const seen = new Set(this.items.map((i) => i.key));
			this.items = [...this.items, ...page.items.filter((i) => !seen.has(i.key) && seen.add(i.key))];
		}
		this.#cursor = page.next;
		this.hasMore = page.next !== null;
	}

	/** Добавляет в словарь подписи, полученные другим путём (разрешение сохранённых id). */
	remember(items: readonly RemoteItem[]): void {
		for (const item of items) this.known.set(item.key, item);
	}

	dispose(): void {
		this.#later.cancel();
		this.#seq += 1;
	}
}
