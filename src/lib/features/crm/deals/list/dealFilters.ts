// Фильтры списка сделок живут в адресной строке (`?q=&type=b2b&quick=mine`): «Назад», перезагрузка и ссылки работают.
// Здесь — чтение параметров, перевод в query API и подсчёт включённых фильтров.

export type DealView = 'table' | 'board';
export type QuickFilter = 'all' | 'mine' | 'warning' | 'breached' | 'closed';

export interface DealFilters {
	view: DealView;
	quick: QuickFilter;
	q: string;
	workflow: string;
	status: string;
	type: string;
	priority: string;
	owner: string;
	region: string;
	product: string;
	from: string;
	to: string;
}

const QUICK = new Set<string>(['all', 'mine', 'warning', 'breached', 'closed']);

export function readFilters(params: URLSearchParams): DealFilters {
	const get = (name: string) => params.get(name) ?? '';
	const quick = get('quick');
	return {
		view: get('view') === 'board' ? 'board' : 'table',
		quick: (QUICK.has(quick) ? quick : 'all') as QuickFilter,
		q: get('q'),
		workflow: get('workflow'),
		status: get('status'),
		type: get('type'),
		priority: get('priority'),
		owner: get('owner'),
		region: get('region'),
		product: get('product'),
		from: get('from'),
		to: get('to')
	};
}

const startOfDay = (iso: string) => new Date(`${iso}T00:00:00`).toISOString();
const endOfDay = (iso: string) => new Date(`${iso}T23:59:59.999`).toISOString();

export interface DealQuery {
	q?: string;
	workflow_id?: string;
	/** повторяемый параметр (несколько статусов); UI выбирает один */
	status_id?: string[];
	deal_type?: string;
	priority?: string;
	owner_id?: string;
	region_id?: string;
	product_id?: string;
	sla_state?: string;
	closed_from?: string;
	created_from?: string;
	created_to?: string;
}

/** Параметры `GET /api/deals`. «Мои» = ответственный я (если ответственный не выбран вручную). */
export function toQuery(f: DealFilters, meId: string | null | undefined): DealQuery {
	const query: DealQuery = {
		q: f.q.trim() || undefined,
		workflow_id: f.workflow || undefined,
		status_id: f.status ? [f.status] : undefined,
		deal_type: f.type || undefined,
		priority: f.priority || undefined,
		owner_id: f.owner || undefined,
		region_id: f.region || undefined,
		product_id: f.product || undefined,
		created_from: f.from ? startOfDay(f.from) : undefined,
		created_to: f.to ? endOfDay(f.to) : undefined
	};
	if (f.quick === 'mine' && !query.owner_id && meId) query.owner_id = meId;
	if (f.quick === 'warning') query.sla_state = 'warning';
	if (f.quick === 'breached') query.sla_state = 'breached';
	if (f.quick === 'closed') query.closed_from = '1970-01-01T00:00:00Z';
	return query;
}

/** Включённые фильтры панели (без поиска, вида и быстрых чипов). */
export function activeCount(f: DealFilters, hiddenOwner = false): number {
	return [f.workflow, f.status, f.type, f.priority, hiddenOwner ? '' : f.owner, f.region, f.product, f.from || f.to].filter(Boolean).length;
}
