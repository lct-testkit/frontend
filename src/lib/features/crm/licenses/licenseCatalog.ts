// Откуда берутся вендоры и ПО для фильтров и подсказок формы лицензии.
// Отдельных ручек «список вендоров»/«facets» у бэкенда нет, а организации-вендоры видны только их ответственным (скоуп организаций), поэтому
// КАМ и Руководитель список компаний не получат. ПО же — справочник продуктов вида «ПО» (виден всем с чтением каталога), и у каждого ПО есть вендор
// (`vendor_id`, `vendor_name`): вендоры для выбора — это вендоры этого справочника. Лицензия с вендором, которого нет в справочнике, ищется поиском.
import type { Product } from '../types';

export interface VendorOption {
	id: string;
	name: string;
}

export interface SoftwareOption {
	id: string;
	name: string;
	vendorId: string | null;
	vendorName: string | null;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ru');

export function softwareOptions(products: readonly Pick<Product, 'id' | 'name' | 'kind' | 'vendor_id' | 'vendor_name'>[]): SoftwareOption[] {
	return products
		.filter((p) => p.kind === 'software')
		.map((p) => ({ id: p.id, name: p.name, vendorId: p.vendor_id ?? null, vendorName: p.vendor_name ?? null }))
		.sort(byName);
}

/** Вендоры справочника ПО без повторов, по алфавиту. */
export function vendorOptions(software: readonly SoftwareOption[]): VendorOption[] {
	const seen = new Map<string, VendorOption>();
	for (const s of software) {
		if (s.vendorId && s.vendorName && !seen.has(s.vendorId)) seen.set(s.vendorId, { id: s.vendorId, name: s.vendorName });
	}
	return [...seen.values()].sort(byName);
}

/** ПО одного вендора; без вендора — всё ПО. */
export function softwareOf(software: readonly SoftwareOption[], vendorId: string | null | undefined): SoftwareOption[] {
	return vendorId ? software.filter((s) => s.vendorId === vendorId) : [...software];
}
