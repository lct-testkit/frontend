// Воронки: список опубликованных и кэш графов (статусы, переходы с деревом условий, SLA-правила).
// Граф нужен везде, где рисуется статус сделки (название, цвет, порядок), поэтому он общий и грузится один раз на воронку.
import { SvelteMap } from 'svelte/reactivity';
import { api, unwrap } from '$lib/api';
import { Lazy } from '../shared/lazy.svelte';
import type { Workflow, WorkflowGraph, WorkflowStatus } from '../types';

/** Через сколько кэш графа считается устаревшим. */
export const GRAPH_TTL_MS = 5 * 60_000;

class WorkflowStore {
	published = new Lazy<Workflow[]>(async () => (await unwrap(api.GET('/api/workflows', { params: { query: { state: 'published', limit: 100 } } }))).items);

	#graphs = new SvelteMap<string, WorkflowGraph>();
	#statuses = new SvelteMap<string, WorkflowStatus>();
	#inflight = new Map<string, Promise<WorkflowGraph>>();
	#loadedAt = new Map<string, number>();

	graph(workflowId: string | null | undefined): WorkflowGraph | undefined {
		return workflowId ? this.#graphs.get(workflowId) : undefined;
	}

	status(statusId: string | null | undefined): WorkflowStatus | undefined {
		return statusId ? this.#statuses.get(statusId) : undefined;
	}

	/**
	 * Граф воронки из кэша; старше 5 минут перечитывается (воронку могли переименовать в другой вкладке или другим пользователем),
	 * до ответа остаётся прежний — названия не мигают.
	 */
	ensure(workflowId: string): Promise<WorkflowGraph> {
		const known = this.#graphs.get(workflowId);
		if (known && Date.now() - (this.#loadedAt.get(workflowId) ?? 0) < GRAPH_TTL_MS) return Promise.resolve(known);
		let pending = this.#inflight.get(workflowId);
		if (!pending) {
			pending = unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: workflowId } } }))
				.then((graph) => {
					this.#graphs.set(workflowId, graph);
					this.#loadedAt.set(workflowId, Date.now());
					for (const status of graph.statuses) this.#statuses.set(status.id, status);
					return graph;
				})
				.finally(() => this.#inflight.delete(workflowId));
			this.#inflight.set(workflowId, pending);
		}
		return pending;
	}

	ensureMany(ids: Iterable<string | null | undefined>): void {
		for (const id of new Set(ids)) if (id && !this.#graphs.has(id)) void this.ensure(id).catch(() => {});
	}

	/** Перечитать граф (после публикации новой версии воронки или переименования шага). */
	reload(workflowId: string): Promise<WorkflowGraph> {
		this.#loadedAt.delete(workflowId);
		return this.ensure(workflowId);
	}
}

export const workflows = new WorkflowStore();
