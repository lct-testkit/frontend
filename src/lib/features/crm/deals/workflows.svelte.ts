// Воронки: список опубликованных и кэш графов (статусы, переходы с деревом условий, SLA-правила).
// Граф нужен везде, где рисуется статус сделки (название, цвет, порядок), поэтому он общий и грузится один раз на воронку.
import { SvelteMap } from 'svelte/reactivity';
import { api, unwrap } from '$lib/api';
import { Lazy } from '../shared/lazy.svelte';
import type { Workflow, WorkflowGraph, WorkflowStatus } from '../types';

class WorkflowStore {
	published = new Lazy<Workflow[]>(async () => (await unwrap(api.GET('/api/workflows', { params: { query: { state: 'published', limit: 100 } } }))).items);

	#graphs = new SvelteMap<string, WorkflowGraph>();
	#statuses = new SvelteMap<string, WorkflowStatus>();
	#inflight = new Map<string, Promise<WorkflowGraph>>();

	graph(workflowId: string | null | undefined): WorkflowGraph | undefined {
		return workflowId ? this.#graphs.get(workflowId) : undefined;
	}

	status(statusId: string | null | undefined): WorkflowStatus | undefined {
		return statusId ? this.#statuses.get(statusId) : undefined;
	}

	ensure(workflowId: string): Promise<WorkflowGraph> {
		const known = this.#graphs.get(workflowId);
		if (known) return Promise.resolve(known);
		let pending = this.#inflight.get(workflowId);
		if (!pending) {
			pending = unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: workflowId } } }))
				.then((graph) => {
					this.#graphs.set(workflowId, graph);
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

	/** Перечитать граф (после публикации новой версии воронки). */
	reload(workflowId: string): Promise<WorkflowGraph> {
		this.#graphs.delete(workflowId);
		return this.ensure(workflowId);
	}
}

export const workflows = new WorkflowStore();
