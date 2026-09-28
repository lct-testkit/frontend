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
	/** сырой параметр API (`-amount`…); '' — порядок по умолчанию (`-created_at`) */
	sort: string;
}

/** Колонки таблицы сделок, для которых `GET /api/deals` умеет `sort` (совпадают по имени с полями API). */
const SORTABLE_FIELDS = new Set(['number', 'title', 'amount', 'updated_at']);

/** `sort` из адресной строки -> состояние заголовка таблицы (`null` — сортировка не выбрана явно). */
export function sortToState(sort: string): { key: string; dir: 'asc' | 'desc' } | null {
	const key = sort.replace(/^-/, '');
	if (!sort || !SORTABLE_FIELDS.has(key)) return null;
	return { key, dir: sort.startsWith('-') ? 'desc' : 'asc' };
}

/** Состояние заголовка таблицы -> `sort` для адресной строки и API. */
export function stateToSort(state: { key: string; dir: 'asc' | 'desc' } | null): string {
	return state ? (state.dir === 'desc' ? `-${state.key}` : state.key) : '';
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
		to: get('to'),
		sort: get('sort')
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
	is_closed?: boolean;
	created_from?: string;
	created_to?: string;
	sort?: string;
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
		created_to: f.to ? endOfDay(f.to) : undefined,
		sort: f.sort || undefined
	};
	if (f.quick === 'mine' && !query.owner_id && meId) query.owner_id = meId;
	if (f.quick === 'warning') query.sla_state = 'warning';
	if (f.quick === 'breached') query.sla_state = 'breached';
	if (f.quick === 'closed') query.is_closed = true;
	return query;
}

/** Включённые фильтры панели (без поиска, вида и быстрых чипов). */
export function activeCount(f: DealFilters, hiddenOwner = false): number {
	return [f.workflow, f.status, f.type, f.priority, hiddenOwner ? '' : f.owner, f.region, f.product, f.from || f.to].filter(Boolean).length;
}
