// Counts for the tabs of the tasks page («В работе (5)»). The backend has no totals, so each tab asks for one page of 100 and counts it;
// the counts depend only on assignee and priority (not on the tab), so switching tabs costs nothing.
import { api, unwrap } from '$lib/api';
import { countLabel, viewQuery, type TaskView } from './taskUtils';

const VIEWS: TaskView[] = ['open', 'in_progress', 'overdue', 'done', 'all'];
const LIMIT = 100;

export class TaskCounts {
	counts = $state<Partial<Record<TaskView, number | string>>>({});
	#seq = 0;

	async load(base: { assignee_id?: string; priority?: string }): Promise<void> {
		const seq = ++this.#seq;
		try {
			const pages = await Promise.all(
				VIEWS.map((v) => unwrap(api.GET('/api/tasks', { params: { query: { ...base, ...viewQuery(v), limit: LIMIT } } })))
			);
			if (seq !== this.#seq) return;
			this.counts = Object.fromEntries(VIEWS.map((v, i) => [v, countLabel(pages[i].items.length, !!pages[i].next_cursor, LIMIT)]));
		} catch {
			if (seq === this.#seq) this.counts = {}; // no numbers is better than wrong ones
		}
	}
}
