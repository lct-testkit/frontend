// Data of the home screen: everything comes from list endpoints (the backend already scopes them by role).
// Aggregates are computed over the newest 100 visible deals; `partial` tells the UI to show «100+».
import { api, unwrap, type components } from '$lib/api';
import { session } from '$lib/auth/session.svelte';

export type Deal = components['schemas']['DealOut'];
export type Task = components['schemas']['TaskOut'];
export type SignRequest = components['schemas']['SignatureRequestOut'];
export type Status = components['schemas']['StatusOut'];

const OPEN_SIGN = new Set(['pending', 'sent', 'viewed']);

export class HomeData {
	loading = $state(true);
	error = $state<unknown>(null);
	deals = $state<Deal[]>([]);
	/** more deals exist than were loaded */
	partial = $state(false);
	attention = $state<Deal[]>([]);
	tasks = $state<Task[]>([]);
	signatures = $state<SignRequest[]>([]);
	statuses = $state<Record<string, Status>>({});

	#ctrl: AbortController | null = null;

	get active(): Deal[] {
		return this.deals.filter((d) => {
			const type = this.statuses[d.status_id]?.type;
			return type !== 'won' && type !== 'lost';
		});
	}

	get activeAmount(): number {
		return this.active.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);
	}

	get openTasks(): Task[] {
		return this.tasks
			.filter((t) => t.status === 'open' || t.status === 'in_progress')
			.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
	}

	get overdueTasks(): Task[] {
		const now = Date.now();
		return this.openTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
	}

	/** deal type with more active deals — the default funnel tab */
	get mainType(): string {
		const b2c = this.active.filter((d) => d.deal_type === 'b2c').length;
		return b2c > this.active.length - b2c ? 'b2c' : 'b2b';
	}

	get pendingSignatures(): SignRequest[] {
		return this.signatures.filter((s) => OPEN_SIGN.has(s.status));
	}

	/** active deals per status of one deal type, in workflow order */
	funnel(type: string): { status: Status; count: number }[] {
		const counts = new Map<string, number>();
		for (const d of this.active) if (d.deal_type === type) counts.set(d.status_id, (counts.get(d.status_id) ?? 0) + 1);
		return [...counts.entries()]
			.map(([id, count]) => ({ status: this.statuses[id], count }))
			.filter((row): row is { status: Status; count: number } => !!row.status)
			.sort((a, b) => a.status.sort_order - b.status.sort_order);
	}

	async load(): Promise<void> {
		this.#ctrl?.abort();
		const ctrl = (this.#ctrl = new AbortController());
		const { signal } = ctrl;
		this.loading = true;
		this.error = null;
		const me = session.me?.id;
		const canDeals = session.can('deal:read');
		const canSign = session.can('signature:sign');
		try {
			const [deals, breached, warning, tasks, signatures, workflows] = await Promise.all([
				canDeals ? unwrap(api.GET('/api/deals', { params: { query: { limit: 100 } }, signal })) : null,
				canDeals ? unwrap(api.GET('/api/deals', { params: { query: { sla_state: 'breached', limit: 10 } }, signal })) : null,
				canDeals ? unwrap(api.GET('/api/deals', { params: { query: { sla_state: 'warning', limit: 10 } }, signal })) : null,
				canDeals && me ? unwrap(api.GET('/api/tasks', { params: { query: { assignee_id: me, limit: 50 } }, signal })) : null,
				canSign ? unwrap(api.GET('/api/me/signature-requests', { signal })) : null,
				session.can('workflow:read') ? unwrap(api.GET('/api/workflows', { params: { query: { limit: 20 } }, signal })) : null
			]);
			if (signal.aborted) return;

			this.deals = deals?.items ?? [];
			this.partial = !!deals?.next_cursor;
			this.attention = [...(breached?.items ?? []), ...(warning?.items ?? [])];
			this.tasks = tasks?.items ?? [];
			this.signatures = signatures ?? [];

			const statuses: Record<string, Status> = {};
			const published = (workflows?.items ?? []).filter((w) => w.state === 'published');
			const graphs = await Promise.all(published.map((w) => unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: w.id } }, signal }))));
			for (const g of graphs) for (const s of g.statuses) statuses[s.id] = s;
			if (signal.aborted) return;
			this.statuses = statuses;
		} catch (e) {
			if (!signal.aborted) this.error = e;
		} finally {
			if (!signal.aborted) this.loading = false;
		}
	}

	abort(): void {
		this.#ctrl?.abort();
	}
}
