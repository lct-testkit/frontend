// Справочник ПО для фильтров и подсказок лицензий: один запрос на сессию (до 500 продуктов вида «ПО»).
import { api, unwrap } from '$lib/api';
import { Lazy } from '../shared/lazy.svelte';
import type { Product } from '../types';
import { softwareOptions, vendorOptions, type SoftwareOption, type VendorOption } from './licenseCatalog';

async function loadSoftware(): Promise<SoftwareOption[]> {
	const all: Product[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < 5; i++) {
		const page = await unwrap(api.GET('/api/products', { params: { query: { kind: 'software', limit: 100, cursor } } }));
		all.push(...page.items);
		if (!page.next_cursor) break;
		cursor = page.next_cursor;
	}
	return softwareOptions(all);
}

export const softwareCatalog = new Lazy<SoftwareOption[]>(loadSoftware);

export const vendorsOf = (software: SoftwareOption[] | undefined): VendorOption[] => vendorOptions(software ?? []);
