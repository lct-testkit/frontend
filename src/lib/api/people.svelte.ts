// Names of colleagues (authors, owners, assignees, signers…). Backed by GET /api/users/directory: one batched request per tick,
// results cached for the session. `people.name(id)` is reactive: it shows «…» until the name arrives and «Пользователь недоступен» when the directory does not know the id.
import { SvelteMap } from 'svelte/reactivity';
import { api } from './client';

export interface Person {
	id: string;
	full_name: string;
	display_name?: string | null;
	role: string;
	team_id?: string | null;
	status: string;
}

/** пока имя грузится — многоточие, а не фрагмент id: «#52a5» в карточке читается как ошибка */
const LOADING = '…';
const UNKNOWN = 'Пользователь недоступен';
const BATCH = 100;

class People {
	/** undefined = never asked · null = asked, not found */
	#cache = new SvelteMap<string, Person | null>();
	#queue = new Set<string>();
	// Batch already dispatched, response not back yet: id left `#queue` (the batch was cut and
	// sent), but isn't in `#cache` yet either. Without this, a same-id `ensure()` in that window
	// re-queues it and fires a second, overlapping request for the same id (same fix as the
	// `inflight` map in features/signing/known.ts).
	#inflight = new Set<string>();
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** ids, чей запрос не удался несколько раз подряд: показываем прочерк, а не вечное «…» */
	#failed = new Set<string>();
	#attempts = new Map<string, number>();

	get(id: string | null | undefined): Person | null | undefined {
		return id ? this.#cache.get(id) : undefined;
	}

	/** Display name; schedules a lookup when the id is unknown. */
	name(id: string | null | undefined, fallback = '—'): string {
		if (!id) return fallback;
		const person = this.#cache.get(id);
		if (person === undefined) {
			if (this.#failed.has(id)) return fallback;
			this.ensure([id]);
			return LOADING;
		}
		return person ? person.display_name || person.full_name : UNKNOWN;
	}

	ensure(ids: (string | null | undefined)[]): void {
		for (const id of ids) {
			if (!id || !id.trim() || /[,\s]/.test(id)) continue; // пустой или кривой id завалил бы весь пакет (422)
			if (!this.#cache.has(id) && !this.#queue.has(id) && !this.#inflight.has(id) && !this.#failed.has(id)) this.#queue.add(id);
		}
		if (this.#queue.size && this.#timer === undefined) this.#timer = setTimeout(() => void this.#flush(), 15);
	}

	async #flush(): Promise<void> {
		this.#timer = undefined;
		// ручка отдаёт не больше `limit` записей (по умолчанию 50, максимум 100): режем пакеты по 100 и просим ровно столько
		const batch = [...this.#queue].slice(0, BATCH);
		for (const id of batch) {
			this.#queue.delete(id);
			this.#inflight.add(id);
		}
		if (!batch.length) return;
		let retryIn = 15;
		try {
			// openapi-fetch не бросает на 4xx/5xx — смотрим `error`, иначе любой отказ (429, 5xx) превратился бы в «все не найдены»
			const { data, error } = await api.GET('/api/users/directory', { params: { query: { ids: batch.join(','), limit: batch.length } } });
			if (error || !data) throw error ?? new Error('empty');
			const found = new Map(data.items.map((p) => [p.id, p as Person]));
			// «не найден» — только для id, которых нет в УСПЕШНОМ ответе
			for (const id of batch) {
				this.#cache.set(id, found.get(id) ?? null);
				this.#attempts.delete(id);
			}
		} catch {
			
			// отказ не кэшируем: вернём id в очередь и повторим позже (2 с, 4 с, 8 с), после третьей неудачи — прочерк
			for (const id of batch) {
				const n = (this.#attempts.get(id) ?? 0) + 1;
				this.#attempts.set(id, n);
				if (n >= 4) this.#failed.add(id);
				else this.#queue.add(id);
			}
			retryIn = 2000 * 2 ** ((Math.max(...batch.map((id) => this.#attempts.get(id) ?? 1)) - 1) || 0);
		} finally {
			for (const id of batch) this.#inflight.delete(id);
		}
		if (this.#queue.size && this.#timer === undefined) this.#timer = setTimeout(() => void this.#flush(), retryIn);
	}

	/** Typeahead: active colleagues by name, optionally only some roles. */
	async search(q: string, roles?: string[], limit = 20): Promise<Person[]> {
		const { data } = await api.GET('/api/users/directory', {
			params: { query: { q: q || undefined, roles: roles?.length ? roles.join(',') : undefined, limit } }
		});
		const items = (data?.items ?? []) as Person[];
		for (const p of items) this.#cache.set(p.id, p);
		return items;
	}

	/** Put known people into the cache (e.g. from a response that already carries names). */
	remember(person: Person): void {
		this.#cache.set(person.id, person);
	}
}

export const people = new People();
