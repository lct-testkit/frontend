import { describe, expect, it } from 'vitest';
import { LICENSE_FIELD_LABELS, shortVendor, licenseOrgTitle, licenseSignedText, licenseTermInfo, transferStatusLabel, type TermInfo } from './licenseUtils';

// `count()` (src/lib/utils/format.ts) joins the number and the word with a non-breaking space, not a plain one.
const NBSP = ' ';
const NOW = new Date(2026, 9, 18); // 18.10.2026
type Fields = Parameters<typeof licenseTermInfo>[0];
const base: Fields = { is_perpetual: false, license_valid_until: null, license_term_years: null, license_valid_year: null };
const term = (over: Partial<Fields>, now = NOW): TermInfo => licenseTermInfo({ ...base, ...over }, now);

describe('licenseTermInfo', () => {
	it('нет данных — прочерк', () => {
		expect(term({})).toEqual({ text: '—', tone: 'neutral' });
	});

	it('бессрочная', () => {
		expect(term({ is_perpetual: true, license_valid_until: '2020-01-01' })).toEqual({ text: 'Бессрочно', tone: 'neutral' });
	});

	it('дата окончания в будущем году: год без склонения', () => {
		const r = term({ license_valid_until: '2027-06-30' });
		expect(r.text).toBe('2027');
		expect(r.tone).toBe('neutral');
		expect(r.badge).toBeUndefined();
	});

	it('дата окончания в этом году, ещё не наступила: «Истекает»', () => {
		expect(term({ license_valid_until: '2026-12-31' })).toMatchObject({ text: '2026', tone: 'warning', badge: 'Истекает' });
	});

	it('дата окончания в этом году уже прошла: «Истекла»', () => {
		expect(term({ license_valid_until: '2026-03-01' })).toMatchObject({ text: '2026', tone: 'error', badge: 'Истекла' });
	});

	it('граница нового года: 31.12 ещё «Истекает», 01.01 уже «Истекла»', () => {
		const until = { license_valid_until: '2026-12-31' };
		expect(term(until, new Date(2026, 11, 31)).badge).toBe('Истекает');
		expect(term(until, new Date(2027, 0, 1)).badge).toBe('Истекла');
	});

	it('срок в годах без даты окончания', () => {
		expect(term({ license_term_years: 3 })).toMatchObject({ text: `на 3${NBSP}года`, tone: 'neutral' });
		expect(term({ license_term_years: 5 }).text).toBe(`на 5${NBSP}лет`);
	});

	it('старое значение из файла: год окончания', () => {
		expect(term({ license_valid_year: 2024 })).toMatchObject({ text: '2024', badge: 'Истекла' });
		expect(term({ license_valid_year: 2026 })).toMatchObject({ text: '2026', badge: 'Истекает' });
		expect(term({ license_valid_year: 2027 })).toMatchObject({ text: '2027', tone: 'neutral' });
	});

	it('старое значение из файла: «3» — предупреждение, что это срок в годах', () => {
		const r = term({ license_valid_year: 3 });
		expect(r.tone).toBe('warning');
		expect(r.text).toBe(`на 3${NBSP}года`);
		expect(r.badge).toBe('Проверьте');
		expect(r.hint).toContain('срок в годах');
	});

	it('дата окончания важнее старого значения', () => {
		expect(term({ license_valid_until: '2030-01-01', license_valid_year: 2020 }).text).toBe('2030');
	});
});

describe('licenseSignedText', () => {
	it('дата подписания', () => {
		expect(licenseSignedText({ is_signed: true, license_signed_at: '2025-03-05' })).toBe('05.03.2025');
	});
	it('без даты: да, нет, не указано', () => {
		expect(licenseSignedText({ is_signed: true, license_signed_at: null })).toBe('Подписана');
		expect(licenseSignedText({ is_signed: false, license_signed_at: null })).toBe('Не подписана');
		expect(licenseSignedText({ is_signed: null, license_signed_at: null })).toBe('Нет данных');
	});
});

describe('transferStatusLabel', () => {
	it.each([
		[null, '—'],
		[undefined, '—'],
		['not_started', 'Не начата'],
		['in_progress', 'В процессе'],
		['transferred', 'Передана'],
		['declined', 'Не состоялась']
	] as const)('%s -> %s', (status, label) => {
		expect(transferStatusLabel(status)).toBe(label);
	});

	it('неизвестное значение возвращается как есть', () => {
		expect(transferStatusLabel('rescinded' as never)).toBe('rescinded');
	});
});

describe('licenseOrgTitle', () => {
	it('краткое название, иначе полное, иначе прочерк', () => {
		expect(licenseOrgTitle({ organization_name: 'Полное', organization_short_name: 'КСУТ' })).toBe('КСУТ');
		expect(licenseOrgTitle({ organization_name: 'Полное', organization_short_name: null })).toBe('Полное');
		expect(licenseOrgTitle({ organization_name: null, organization_short_name: null })).toBe('—');
	});
});

describe('LICENSE_FIELD_LABELS', () => {
	it('десять полей ТЗ', () => {
		expect(LICENSE_FIELD_LABELS).toHaveLength(10);
	});
});

describe('shortVendor', () => {
	it.each([
		['ООО «Астра Линукс»', 'Астра Линукс'],
		['АО «Лаборатория Касперского»', 'Лаборатория Касперского'],
		['Фирма «1С»', '1С'],
		['Базальт СПО', 'Базальт СПО'],
		['ООО', 'ООО']
	])('%s -> %s', (full, short) => {
		expect(shortVendor(full)).toBe(short);
	});
});
