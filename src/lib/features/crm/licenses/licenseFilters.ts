// Фильтры экрана «Лицензии»: чистые функции между адресной строкой и параметрами `GET /api/organization-licenses`.
// В адресе: `q`, `org`, `vendor`, `product`, `status` (через запятую), `year`, `signed` (`yes`/`no`). Мусор в адресе читается как «не задано».
import { TRANSFER_STATUS_LABELS } from '../shared/labels';

export type SignedFilter = '' | 'yes' | 'no';

export interface LicenseFilters {
	q: string;
	org: string;
	vendor: string;
	product: string;
	status: string[];
	year: string;
	signed: SignedFilter;
}

export const EMPTY_FILTERS: LicenseFilters = { q: '', org: '', vendor: '', product: '', status: [], year: '', signed: '' };

/** Параметры адреса, которыми управляют фильтры (всё, что `setQuery` должен уметь обнулить). */
export const FILTER_KEYS = ['q', 'org', 'vendor', 'product', 'status', 'year', 'signed'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (raw: string | null): string => (raw && UUID.test(raw.trim()) ? raw.trim() : '');

export function readFilters(params: URLSearchParams): LicenseFilters {
	const year = (params.get('year') ?? '').trim();
	const signed = params.get('signed');
	const status = (params.get('status') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s, i, all) => s in TRANSFER_STATUS_LABELS && all.indexOf(s) === i);
	return {
		q: (params.get('q') ?? '').trim(),
		org: uuid(params.get('org')),
		vendor: uuid(params.get('vendor')),
		product: uuid(params.get('product')),
		status,
		year: /^\d{4}$/.test(year) ? year : '',
		signed: signed === 'yes' || signed === 'no' ? signed : ''
	};
}

export interface LicenseQuery {
	q?: string;
	organization_id?: string;
	vendor_id?: string;
	product_id?: string;
	transfer_status?: string[];
	year?: number;
	is_signed?: boolean;
}

/** Параметры запроса списка; пустые фильтры дают пустой объект. */
export function toQuery(f: LicenseFilters): LicenseQuery {
	const query: LicenseQuery = {};
	const q = f.q.trim();
	if (q) query.q = q;
	if (f.org) query.organization_id = f.org;
	if (f.vendor) query.vendor_id = f.vendor;
	if (f.product) query.product_id = f.product;
	if (f.status.length) query.transfer_status = f.status;
	if (f.year) query.year = Number(f.year);
	if (f.signed) query.is_signed = f.signed === 'yes';
	return query;
}

/** Сколько фильтров включено: вуз, вендор, ПО, статус, год, подписание. Поиск не считается. */
export function activeCount(f: LicenseFilters): number {
	return [f.org, f.vendor, f.product, f.status.length > 0, f.year, f.signed].filter(Boolean).length;
}

/** Сколько включено среди полей панели «Фильтры» (статус, год, подписание). */
export function moreCount(f: LicenseFilters): number {
	return [f.status.length > 0, f.year, f.signed].filter(Boolean).length;
}

/** Что записать в адресную строку при смене одного фильтра. Смена вендора сбрасывает ПО (список ПО у другого вендора другой). */
export function patchFor(change: Partial<LicenseFilters>, current: LicenseFilters): Record<string, string | null> {
	const patch: Record<string, string | null> = {};
	const text = (v: string | undefined) => (v ? v : null);
	if ('q' in change) patch.q = text(change.q?.trim());
	if ('org' in change) patch.org = text(change.org);
	if ('vendor' in change) {
		patch.vendor = text(change.vendor);
		if ((change.vendor ?? '') !== current.vendor && !('product' in change)) patch.product = null;
	}
	if ('product' in change) patch.product = text(change.product);
	if ('status' in change) patch.status = change.status?.length ? change.status.join(',') : null;
	if ('year' in change) patch.year = text(change.year);
	if ('signed' in change) patch.signed = text(change.signed);
	return patch;
}

/** Годы для фильтра «Действует в году»: от текущего минус 3 до плюс 6. */
export function yearOptions(now: Date = new Date()): { key: string; value: string }[] {
	const y = now.getFullYear();
	return Array.from({ length: 10 }, (_, i) => String(y + 6 - i)).map((key) => ({ key, value: key }));
}
