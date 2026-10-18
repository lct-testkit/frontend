// Форма лицензии: проверка введённого и тела запросов `POST`/`PATCH /api/organization-licenses`.
// Контракт бэкенда (B3-6): вендор и ПО — ссылкой (`vendor_id`/`product_id`) или текстом (`vendor`/`product_name`, сервер ищет совпадение);
// «Подписание» — `is_signed` и/или `license_signed_at`; «Срок» — `license_valid_until` (дата), `license_term_years` (1–50) или `is_perpetual`.
// ФИО менеджера и ответственные без права `contact:reveal` приходят маскированными: в `PATCH` их нельзя отправлять, иначе в базу запишется маска.
import type { OrganizationLicense } from '../types';

export type SignedState = '' | 'yes' | 'no';

export interface LicenseValues {
	orgId: string | null;
	vendor: string;
	vendorId: string | null;
	product: string;
	productId: string | null;
	contract: string;
	status: string | null;
	signedState: SignedState;
	signedAt: string | null;
	perpetual: boolean;
	validUntil: string | null;
	termYears: number | null;
	manager: string;
	responsible: string;
	comment: string;
}

export const EMPTY_VALUES: LicenseValues = {
	orgId: null,
	vendor: '',
	vendorId: null,
	product: '',
	productId: null,
	contract: '',
	status: null,
	signedState: '',
	signedAt: null,
	perpetual: false,
	validUntil: null,
	termYears: null,
	manager: '',
	responsible: '',
	comment: ''
};

export const MAX_LEN = { vendor: 255, product: 255, contract: 128, manager: 255 } as const;
export const TERM_YEARS = { min: 1, max: 50 } as const;

/** Значения формы из записи (для правки) или пустые (для создания; `orgId` — вуз, из карточки которого открыта форма). */
export function valuesFrom(item: OrganizationLicense | null, orgId: string | null = null): LicenseValues {
	if (!item) return { ...EMPTY_VALUES, orgId };
	return {
		orgId: item.organization_id,
		vendor: item.vendor,
		vendorId: item.vendor_id ?? null,
		product: item.product_name,
		productId: item.product_id ?? null,
		contract: item.contract_number ?? '',
		status: item.transfer_status ?? null,
		signedState: item.is_signed === true ? 'yes' : item.is_signed === false ? 'no' : item.license_signed_at ? 'yes' : '',
		signedAt: item.license_signed_at ?? null,
		perpetual: item.is_perpetual,
		validUntil: item.license_valid_until ?? null,
		termYears: item.license_term_years ?? null,
		manager: item.manager_full_name ?? '',
		responsible: item.responsible_contacts ?? '',
		comment: item.comment ?? ''
	};
}

export type LicenseErrors = Partial<Record<'organization_id' | 'vendor' | 'product_name' | 'contract_number' | 'license_signed_at' | 'license_valid_until' | 'license_term_years' | 'manager_full_name', string>>;

export function validateLicense(v: LicenseValues, opts: { isNew: boolean }): LicenseErrors {
	const e: LicenseErrors = {};
	if (opts.isNew && !v.orgId) e.organization_id = 'Выберите вуз';
	if (!v.vendor.trim()) e.vendor = 'Укажите вендора';
	else if (v.vendor.trim().length > MAX_LEN.vendor) e.vendor = `Не длиннее ${MAX_LEN.vendor} знаков`;
	if (!v.product.trim()) e.product_name = 'Укажите ПО';
	else if (v.product.trim().length > MAX_LEN.product) e.product_name = `Не длиннее ${MAX_LEN.product} знаков`;
	if (v.contract.trim().length > MAX_LEN.contract) e.contract_number = `Не длиннее ${MAX_LEN.contract} знаков`;
	if (v.manager.trim().length > MAX_LEN.manager) e.manager_full_name = `Не длиннее ${MAX_LEN.manager} знаков`;
	if (v.termYears !== null && (!Number.isInteger(v.termYears) || v.termYears < TERM_YEARS.min || v.termYears > TERM_YEARS.max)) {
		e.license_term_years = `Целое число от ${TERM_YEARS.min} до ${TERM_YEARS.max}`;
	}
	if (v.signedState === 'no' && v.signedAt) e.license_signed_at = 'Дата указана, а лицензия отмечена как не подписанная';
	if (v.perpetual && (v.validUntil || v.termYears !== null)) e.license_valid_until = 'У бессрочной лицензии нет даты окончания и срока';
	else if (v.signedAt && v.validUntil && v.validUntil < v.signedAt) e.license_valid_until = 'Раньше даты подписания';
	return e;
}

const text = (s: string): string | null => s.trim() || null;

function signedFields(v: LicenseValues): { is_signed: boolean | null; license_signed_at: string | null } {
	const is_signed = v.signedState === 'yes' ? true : v.signedState === 'no' ? false : v.signedAt ? true : null;
	return { is_signed, license_signed_at: v.signedAt };
}

/** Тело `POST`: пробелы обрезаны, пустое — `null`; вендор и ПО уходят и текстом, и ссылкой (если выбраны из справочника). */
export function toCreateBody(v: LicenseValues) {
	return {
		organization_id: v.orgId as string,
		vendor: v.vendor.trim(),
		vendor_id: v.vendorId,
		product_name: v.product.trim(),
		product_id: v.productId,
		contract_number: text(v.contract),
		transfer_status: v.status,
		...signedFields(v),
		is_perpetual: v.perpetual,
		license_valid_until: v.perpetual ? null : v.validUntil,
		license_term_years: v.perpetual ? null : v.termYears,
		manager_full_name: text(v.manager),
		responsible_contacts: text(v.responsible),
		comment: text(v.comment)
	};
}

export interface LicensePatch {
	vendor?: string;
	vendor_id?: string | null;
	product_name?: string;
	product_id?: string | null;
	contract_number?: string | null;
	transfer_status?: string | null;
	is_signed?: boolean | null;
	license_signed_at?: string | null;
	is_perpetual?: boolean;
	license_valid_until?: string | null;
	license_term_years?: number | null;
	manager_full_name?: string | null;
	responsible_contacts?: string | null;
	comment?: string | null;
}

/**
 * Тело `PATCH`: только изменённые поля. Вендор и ПО уходят парой «текст + ссылка» — иначе сервер оставил бы старую ссылку при новом тексте.
 * `canReveal=false`: ФИО менеджера и ответственные в тело не попадают никогда (в форме они пришли маскированными).
 */
export function toPatchBody(base: OrganizationLicense, v: LicenseValues, canReveal: boolean): LicensePatch {
	const before = valuesFrom(base);
	const patch: LicensePatch = {};
	if (v.vendor.trim() !== before.vendor.trim() || v.vendorId !== before.vendorId) {
		patch.vendor = v.vendor.trim();
		patch.vendor_id = v.vendorId;
	}
	if (v.product.trim() !== before.product.trim() || v.productId !== before.productId) {
		patch.product_name = v.product.trim();
		patch.product_id = v.productId;
	}
	if (text(v.contract) !== text(before.contract)) patch.contract_number = text(v.contract);
	if (v.status !== before.status) patch.transfer_status = v.status;
	const signed = signedFields(v);
	const was = signedFields(before);
	if (signed.is_signed !== was.is_signed) patch.is_signed = signed.is_signed;
	if (signed.license_signed_at !== was.license_signed_at) patch.license_signed_at = signed.license_signed_at;
	if (v.perpetual !== before.perpetual) patch.is_perpetual = v.perpetual;
	const until = v.perpetual ? null : v.validUntil;
	const years = v.perpetual ? null : v.termYears;
	if (until !== before.validUntil) patch.license_valid_until = until;
	if (years !== before.termYears) patch.license_term_years = years;
	if (canReveal) {
		if (text(v.manager) !== text(before.manager)) patch.manager_full_name = text(v.manager);
		if (text(v.responsible) !== text(before.responsible)) patch.responsible_contacts = text(v.responsible);
	}
	if (text(v.comment) !== text(before.comment)) patch.comment = text(v.comment);
	return patch;
}

/** Введённое отличается от записи (для кнопки «Сохранить»). */
export const isChanged = (base: OrganizationLicense, v: LicenseValues, canReveal: boolean): boolean => Object.keys(toPatchBody(base, v, canReveal)).length > 0;
