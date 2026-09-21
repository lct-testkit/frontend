// Справочники, которые нужны нескольким экранам (регионы, продукты, причины отказа, пользовательские поля).
import { api, unwrap } from '$lib/api';
import { Lazy } from './lazy.svelte';
import type { CustomFieldDef, LossReason, Product, Region } from '../types';

export const regions = new Lazy<Region[]>(async () => (await unwrap(api.GET('/api/regions'))).items);

export const lossReasons = new Lazy<LossReason[]>(
	async () => (await unwrap(api.GET('/api/loss-reasons', { params: { query: { is_active: true } } }))).items
);

export const products = new Lazy<Product[]>(async () => {
	const out: Product[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < 5; i += 1) {
		const page = await unwrap(api.GET('/api/products', { params: { query: { is_active: true, limit: 100, cursor } } }));
		out.push(...page.items);
		if (!page.next_cursor) break;
		cursor = page.next_cursor;
	}
	return out;
});

export const dealFieldDefs = new Lazy<CustomFieldDef[]>(
	async () => (await unwrap(api.GET('/api/custom-field-defs', { params: { query: { entity_type: 'deal', is_active: true } } }))).items
);

export const regionName = (id: string | null | undefined): string => (id ? (regions.value?.find((r) => r.id === id)?.name ?? '—') : '—');
