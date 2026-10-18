import { describe, expect, it } from 'vitest';
import { EMPTY_VALUES, isChanged, toCreateBody, toPatchBody, validateLicense, valuesFrom, type LicenseValues } from './licenseForm';
import { makeLicense } from './testing';

const ORG = '01a14ec0-0000-7000-8000-000000000001';
const filled = (over: Partial<LicenseValues> = {}): LicenseValues => ({ ...EMPTY_VALUES, orgId: ORG, vendor: 'Вендор', product: 'ПО', ...over });

describe('validateLicense', () => {
	it('обязательны вуз, вендор и ПО; номер договора можно оставить пустым', () => {
		expect(validateLicense(EMPTY_VALUES, { isNew: true })).toEqual({ organization_id: 'Выберите вуз', vendor: 'Укажите вендора', product_name: 'Укажите ПО' });
		expect(validateLicense(filled(), { isNew: true })).toEqual({});
	});

	it('при правке вуз не проверяется (он не меняется)', () => {
		expect(validateLicense(filled({ orgId: null }), { isNew: false })).toEqual({});
	});

	it('пробелы вместо вендора — не вендор', () => {
		expect(validateLicense(filled({ vendor: '   ' }), { isNew: true }).vendor).toBe('Укажите вендора');
	});

	it.each([0, 51, 2.5, -1])('срок в годах %s отклоняется', (years) => {
		expect(validateLicense(filled({ termYears: years }), { isNew: true }).license_term_years).toBeTruthy();
	});

	it.each([1, 3, 50])('срок в годах %s проходит', (years) => {
		expect(validateLicense(filled({ termYears: years }), { isNew: true })).toEqual({});
	});

	it('дата окончания раньше подписания — ошибка', () => {
		const e = validateLicense(filled({ signedState: 'yes', signedAt: '2026-05-01', validUntil: '2026-04-30' }), { isNew: true });
		expect(e.license_valid_until).toBe('Раньше даты подписания');
		expect(validateLicense(filled({ signedAt: '2026-05-01', validUntil: '2027-04-30' }), { isNew: true })).toEqual({});
	});

	it('бессрочная лицензия не может иметь дату окончания или срок', () => {
		expect(validateLicense(filled({ perpetual: true, validUntil: '2030-01-01' }), { isNew: true }).license_valid_until).toBeTruthy();
		expect(validateLicense(filled({ perpetual: true, termYears: 3 }), { isNew: true }).license_valid_until).toBeTruthy();
		expect(validateLicense(filled({ perpetual: true }), { isNew: true })).toEqual({});
	});

	it('«не подписана» и дата подписания противоречат друг другу', () => {
		expect(validateLicense(filled({ signedState: 'no', signedAt: '2026-01-01' }), { isNew: true }).license_signed_at).toBeTruthy();
	});

	it('слишком длинный номер договора', () => {
		expect(validateLicense(filled({ contract: 'x'.repeat(129) }), { isNew: true }).contract_number).toContain('128');
	});
});

describe('toCreateBody', () => {
	it('обрезает пробелы, пустое превращает в null', () => {
		const body = toCreateBody(filled({ vendor: '  Астра ', product: ' Linux  ', contract: '   ', manager: ' ', comment: '  заметка ' }));
		expect(body).toMatchObject({ organization_id: ORG, vendor: 'Астра', product_name: 'Linux', contract_number: null, manager_full_name: null, comment: 'заметка', is_signed: null });
	});

	it('дата подписания без выбранного состояния означает «подписана»', () => {
		expect(toCreateBody(filled({ signedAt: '2026-02-01' }))).toMatchObject({ is_signed: true, license_signed_at: '2026-02-01' });
		expect(toCreateBody(filled({ signedState: 'no' }))).toMatchObject({ is_signed: false, license_signed_at: null });
	});

	it('у бессрочной лицензии срок и дата окончания не уходят', () => {
		expect(toCreateBody(filled({ perpetual: true, validUntil: '2030-01-01', termYears: 3 }))).toMatchObject({ is_perpetual: true, license_valid_until: null, license_term_years: null });
	});

	it('выбранные из справочника вендор и ПО уходят и ссылкой', () => {
		expect(toCreateBody(filled({ vendorId: 'v1', productId: 'p1' }))).toMatchObject({ vendor_id: 'v1', product_id: 'p1' });
	});
});

describe('toPatchBody', () => {
	const base = makeLicense({ comment: 'было' });

	it('без правок тело пустое', () => {
		expect(toPatchBody(base, valuesFrom(base), true)).toEqual({});
		expect(isChanged(base, valuesFrom(base), true)).toBe(false);
	});

	it('только изменённые поля', () => {
		const v = { ...valuesFrom(base), status: 'in_progress', comment: 'стало' };
		expect(toPatchBody(base, v, true)).toEqual({ transfer_status: 'in_progress', comment: 'стало' });
	});

	it('смена вендора уходит парой «текст + ссылка»', () => {
		const v = { ...valuesFrom(base), vendor: 'Другой', vendorId: null };
		expect(toPatchBody(base, v, true)).toEqual({ vendor: 'Другой', vendor_id: null });
	});

	it('без права «показывать ПДн» маскированные ФИО и ответственные не отправляются, даже изменённые', () => {
		const masked = makeLicense({ manager_full_name: 'О. И. П.', responsible_contacts: 'Б. Т. С.' });
		const v = { ...valuesFrom(masked), manager: 'Новое Имя', responsible: 'Другие', comment: 'правка' };
		expect(toPatchBody(masked, v, false)).toEqual({ comment: 'правка' });
		expect(toPatchBody(masked, v, true)).toEqual({ manager_full_name: 'Новое Имя', responsible_contacts: 'Другие', comment: 'правка' });
	});

	it('очистка поля уходит как null', () => {
		const v = { ...valuesFrom(base), comment: '', contract: '' };
		expect(toPatchBody(base, v, true)).toEqual({ comment: null, contract_number: null });
	});

	it('включение «бессрочно» обнуляет дату окончания', () => {
		const v = { ...valuesFrom(base), perpetual: true };
		expect(toPatchBody(base, v, true)).toEqual({ is_perpetual: true, license_valid_until: null });
	});
});

describe('valuesFrom', () => {
	it('для создания подставляет вуз из карточки вуза', () => {
		expect(valuesFrom(null, ORG).orgId).toBe(ORG);
	});

	it('подписана без даты и с датой читаются как «подписана»', () => {
		expect(valuesFrom(makeLicense({ is_signed: null, license_signed_at: '2025-01-01' })).signedState).toBe('yes');
		expect(valuesFrom(makeLicense({ is_signed: false, license_signed_at: null })).signedState).toBe('no');
		expect(valuesFrom(makeLicense({ is_signed: null, license_signed_at: null })).signedState).toBe('');
	});
});
