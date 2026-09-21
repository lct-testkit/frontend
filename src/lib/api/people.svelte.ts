// Names of colleagues (authors, owners, assignees, signers…). Backed by GET /api/users/directory: one batched request per tick,
// results cached for the session. `people.name(id)` is reactive: it shows a short id until the name arrives.
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

const short = (id: string) => `#${id.slice(-4)}`;

class People {
	/** undefined = never asked · null = asked, not found */
	#cache = new SvelteMap<string, Person | null>();
	#queue = new Set<string>();
	#timer: ReturnType<typeof setTimeout> | undefined;

	get(id: string | null | undefined): Person | null | undefined {
		return id ? this.#cache.get(id) : undefined;
	}

	/** Display name; schedules a lookup when the id is unknown. */
	name(id: string | null | undefined, fallback = '—'): string {
		if (!id) return fallback;
		const person = this.#cache.get(id);
		if (person === undefined) {
			this.ensure([id]);
			return short(id);
		}
		return person ? person.display_name || person.full_name : short(id);
	}

	ensure(ids: (string | null | undefined)[]): void {
		for (const id of ids) if (id && !this.#cache.has(id) && !this.#queue.has(id)) this.#queue.add(id);
		if (this.#queue.size && this.#timer === undefined) this.#timer = setTimeout(() => void this.#flush(), 15);
	}

	async #flush(): Promise<void> {
		this.#timer = undefined;
		const batch = [...this.#queue].slice(0, 200);
		for (const id of batch) this.#queue.delete(id);
		if (!batch.length) return;
		try {
			const { data } = await api.GET('/api/users/directory', { params: { query: { ids: batch.join(',') } } });
			const found = new Map((data?.items ?? []).map((p) => [p.id, p as Person]));
			for (const id of batch) this.#cache.set(id, found.get(id) ?? null);
		} catch {
			// leave unknown: the next `ensure` retries
		}
		if (this.#queue.size) this.#timer = setTimeout(() => void this.#flush(), 15);
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
