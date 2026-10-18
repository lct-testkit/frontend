// Список опубликованных воронок для поля «Воронка» в формах отчётов и виджетов; ошибка загрузки не молчит — поле показывает «Повторить».
import { api, unwrap } from '$lib/api';
import type { WorkflowOption } from './ParamsForm.svelte';

export class WorkflowList {
	items = $state<WorkflowOption[]>([]);
	failed = $state(false);
	#loading = false;

	/** Загружает один раз; после ошибки повторный вызов пробует снова. */
	async load(): Promise<void> {
		if (this.#loading || (this.items.length > 0 && !this.failed)) return;
		this.#loading = true;
		try {
			const r = await unwrap(api.GET('/api/workflows', { params: { query: { state: 'published', limit: 100 } } }));
			this.items = r.items.map((w) => ({ id: w.id, name: w.name, deal_type: w.deal_type }));
			this.failed = false;
		} catch {
			this.failed = true;
		} finally {
			this.#loading = false;
		}
	}
}
