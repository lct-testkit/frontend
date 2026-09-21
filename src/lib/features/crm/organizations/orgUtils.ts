// Организации: значения формы ↔ тела запросов, расхождения реквизитов с ЕГРЮЛ, догадка о типе по названию.
import type { components } from '$lib/api';
import { ORG_FIELD_LABELS, REGISTRY_STATUS_LABELS } from '../shared/labels';
import type { OrgDetails, Organization } from '../types';

type S = components['schemas'];

/** Поля, которые заполняются из реестра и помечаются «из ЕГРЮЛ» / «изменено вручную». */
export const REGISTRY_FIELDS = ['name', 'short_name', 'kpp', 'ogrn', 'legal_address'] as const;

export interface OrgFormValues {
	name: string;
	short_name: string;
	org_type: string;
	inn: string;
	kpp: string;
	ogrn: string;
	legal_address: string;
	actual_address: string;
	region_id: string | null;
	website: string;
	main_phone: string;
	main_email: string;
	students_count: number | null;
	owner_id: string | null;
}

export const emptyOrgForm = (): OrgFormValues => ({
	name: '',
	short_name: '',
	org_type: 'university',
	inn: '',
	kpp: '',
	ogrn: '',
	legal_address: '',
	actual_address: '',
	region_id: null,
	website: '',
	main_phone: '',
	main_email: '',
	students_count: null,
	owner_id: null
});

export function formFromOrg(org: Organization): OrgFormValues {
	return {
		name: org.name,
		short_name: org.short_name ?? '',
		org_type: org.org_type,
		inn: org.inn ?? '',
		kpp: org.kpp ?? '',
		ogrn: org.ogrn ?? '',
		legal_address: org.legal_address ?? '',
		actual_address: org.actual_address ?? '',
		region_id: org.region_id ?? null,
		website: org.website ?? '',
		main_phone: org.main_phone ?? '',
		main_email: org.main_email ?? '',
		students_count: org.students_count ?? null,
		owner_id: org.owner_id ?? null
	};
}

/** Тип по названию и ИНН: 12 цифр — ИП, «колледж/техникум» — колледж, «университет/институт/академия» — вуз, иначе компания. */
export function guessOrgType(name: string, inn: string): string {
	if (inn.replace(/\D/g, '').length === 12) return 'individual_entrepreneur';
	const n = name.toLowerCase();
	if (/колледж|техникум|училищ/.test(n)) return 'college';
	if (/университет|институт|академи|вуз/.test(n)) return 'university';
	return 'company';
}

/** Значения формы из карточки реестра (`GET /org-lookup/inn/{inn}`). */
export function formFromDetails(d: OrgDetails): Partial<OrgFormValues> {
	return {
		name: d.full_name,
		short_name: d.short_name ?? '',
		inn: d.inn,
		kpp: d.kpp ?? '',
		ogrn: d.ogrn ?? '',
		legal_address: d.legal_address ?? '',
		org_type: guessOrgType(d.full_name, d.inn)
	};
}

const text = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);

export function toCreateBody(v: OrgFormValues): S['OrganizationCreateRequest'] {
	return {
		name: text(v.name),
		short_name: text(v.short_name),
		org_type: v.org_type as S['OrganizationCreateRequest']['org_type'],
		inn: text(v.inn),
		kpp: text(v.kpp),
		ogrn: text(v.ogrn),
		legal_address: text(v.legal_address),
		actual_address: text(v.actual_address),
		region_id: v.region_id ?? undefined,
		website: text(v.website),
		main_phone: text(v.main_phone),
		main_email: text(v.main_email),
		students_count: v.students_count ?? undefined,
		owner_id: v.owner_id ?? undefined
	};
}

const PATCHABLE = ['name', 'short_name', 'org_type', 'kpp', 'ogrn', 'legal_address', 'actual_address', 'region_id', 'website', 'main_phone', 'main_email', 'students_count', 'owner_id'] as const;

/** Только изменённые поля (ИНН после создания не меняется). Очищенное поле уходит как `null`. Маскированные контакты ИП не шлём, пока их не тронули. */
export function toPatchBody(original: OrgFormValues, next: OrgFormValues): S['OrganizationUpdateRequest'] {
	const body: Record<string, unknown> = {};
	for (const key of PATCHABLE) {
		const a = original[key];
		const b = next[key];
		if (a === b) continue;
		body[key] = typeof b === 'string' ? (b.trim() ? b.trim() : null) : b;
	}
	return body as S['OrganizationUpdateRequest'];
}

export interface DriftEntry {
	field: string;
	label: string;
	current: string;
	next: string;
}

const show = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v));
/** the status of the registry reads as words («Действует»), everything else as it is */
const showField = (field: string, v: unknown): string => (field === 'registry_status' && typeof v === 'string' ? (REGISTRY_STATUS_LABELS[v] ?? v) : show(v));

/**
 * Расхождения с ЕГРЮЛ для баннера. Сверка бэкенда пишет `{ поле: { old, new } }` (registry/tasks.py:_compute_drift),
 * а `apply-drift` ждёт «новое значение» — читаем оба варианта.
 */
export function driftEntries(org: Pick<Organization, 'requisites_drift'> & Partial<Organization>): DriftEntry[] {
	const drift = org.requisites_drift;
	if (!drift || typeof drift !== 'object') return [];
	return Object.entries(drift).map(([field, raw]) => {
		const pair = raw && typeof raw === 'object' && 'new' in (raw as Record<string, unknown>) ? (raw as { old?: unknown; new?: unknown }) : null;
		const current = pair ? pair.old : (org as Record<string, unknown>)[field];
		const next = pair ? pair.new : raw;
		return { field, label: ORG_FIELD_LABELS[field] ?? field, current: showField(field, current), next: showField(field, next) };
	});
}
