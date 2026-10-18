// Воронки и их статусы для выбора маршрута заявок: список воронок читается один раз, графы — по требованию и кэшируются.
import { api, unwrap } from '$lib/api';
import type { Workflow } from '../types';
import type { StatusLike } from './routing';

export class TargetOptions {
	workflows = $state<Workflow[]>([]);
	loading = $state(false);
	error = $state<unknown>(null);
	loaded = $state(false);
	/** статусы по коду воронки; `undefined` — ещё не читались */
	statuses = $state<Record<string, StatusLike[] | undefined>>({});
	#pending = new Set<string>();

	async load(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const page = await unwrap(api.GET('/api/workflows', { params: { query: { limit: 100 } } }));
			this.workflows = page.items;
			this.loaded = true;
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	/** Код воронки, в которую пойдёт заявка: выбранная или воронка по умолчанию для типа. */
	effectiveCode(dealType: string, code: string | null | undefined): string | null {
		if (code) return code;
		return this.workflows.find((w) => w.deal_type === dealType && w.is_default && w.state === 'published')?.code ?? null;
	}

	/** Читает граф воронки (если ещё не читался); повторные вызовы и параллельные запросы схлопываются. */
	async ensureStatuses(code: string | null): Promise<void> {
		if (!code || this.statuses[code] || this.#pending.has(code)) return;
		const wf = this.workflows.find((w) => w.code === code);
		if (!wf) return;
		this.#pending.add(code);
		try {
			const graph = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: wf.id } } }));
			this.statuses[code] = graph.statuses.map((s) => ({ code: s.code, name: s.name, type: s.type, sort_order: s.sort_order, is_archived: s.is_archived }));
		} catch {
			// статусы просто не предлагаются; выбор воронки от этого не ломается
		} finally {
			this.#pending.delete(code);
		}
	}
}
