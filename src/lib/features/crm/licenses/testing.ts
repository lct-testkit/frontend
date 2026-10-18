// Фикстуры тестов лицензий: запись с десятью полями ТЗ и версией.
import type { OrganizationLicense } from '../types';

export function makeLicense(overrides: Partial<OrganizationLicense> = {}): OrganizationLicense {
	return {
		id: '01a14fff-0000-7000-8000-000000000001',
		organization_id: '01a14ec0-0000-7000-8000-000000000001',
		organization_name: 'Красноярский сибирский университет технологий',
		organization_short_name: 'КСУТ',
		vendor: 'ООО «Астра Линукс»',
		vendor_id: '01a14fef-0000-7000-8000-000000000001',
		product_name: 'Astra Linux Special Edition',
		product_id: '01a14fef-0000-7000-8000-000000000002',
		contract_number: 'ЛД-2025/044',
		license_signed_at: '2025-09-03',
		license_valid_year: 2027,
		transfer_status: 'transferred',
		manager_full_name: 'Орлов Игорь Павлович',
		responsible_contacts: 'Белова Т. С., проректор по ИТ',
		comment: null,
		is_signed: true,
		license_term_years: null,
		license_valid_until: '2027-09-02',
		is_perpetual: false,
		version: 3,
		created_at: '2026-10-01T10:00:00Z',
		updated_at: '2026-10-01T10:00:00Z',
		...overrides
	};
}

/** Три лицензии с годами окончания 2024, 2026, 2027 и одна без срока. */
export function makeLicenses(): OrganizationLicense[] {
	return [
		makeLicense({ id: 'l-2024', license_valid_until: '2024-12-31', license_valid_year: 2024 }),
		makeLicense({ id: 'l-2026', license_valid_until: '2026-12-31', license_valid_year: 2026 }),
		makeLicense({ id: 'l-2027', license_valid_until: '2027-12-31', license_valid_year: 2027 }),
		makeLicense({ id: 'l-none', license_valid_until: null, license_valid_year: null, license_term_years: null })
	];
}
