// Команды организации целиком (их десятки, а не тысячи): нужны фильтру и форме пользователей, дереву команд, карточке.
import { api, unwrap } from '$lib/api';
import type { TeamOut } from './types';

class Teams {
	items = $state<TeamOut[]>([]);
	loaded = $state(false);
	loading = $state(false);
	error = $state<unknown>(null);
	#inflight: Promise<void> | null = null;

	load(force = false): Promise<void> {
		if (this.loaded && !force) return Promise.resolve();
		this.#inflight ??= this.#fetch().finally(() => (this.#inflight = null));
		return this.#inflight;
	}

	async #fetch(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const all: TeamOut[] = [];
			let cursor: string | null = null;
			do {
				const page: { items: TeamOut[]; next_cursor?: string | null } = await unwrap(api.GET('/api/admin/teams', { params: { query: { limit: 100, cursor } } }));
				all.push(...page.items);
				cursor = page.next_cursor ?? null;
			} while (cursor);
			this.items = all;
			this.loaded = true;
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	get(id: string | null | undefined): TeamOut | undefined {
		return id ? this.items.find((t) => t.id === id) : undefined;
	}

	name(id: string | null | undefined, fallback = '—'): string {
		return this.get(id)?.name ?? fallback;
	}

	/** Для Select: `{ key, value }`, отсортировано по названию. */
	get options() {
		return [...this.items].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((t) => ({ key: t.id, value: t.name }));
	}

	put(team: TeamOut): void {
		this.items = this.items.some((t) => t.id === team.id) ? this.items.map((t) => (t.id === team.id ? team : t)) : [...this.items, team];
	}

	/** После успешного `DELETE /api/admin/teams/{id}` — убрать команду из кэша без перезагрузки всего списка. */
	remove(id: string): void {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const teams = new Teams();
