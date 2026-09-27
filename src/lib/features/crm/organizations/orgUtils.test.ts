import { describe, expect, it } from 'vitest';
import type { Organization } from '../types';
import { driftEntries, emptyOrgForm, formFromOrg, guessOrgType, markedLabel, registryMark, toCreateBody, toPatchBody } from './orgUtils';

const org = (over: Partial<Organization> = {}): Organization =>
	({
		id: '1',
		name: 'Казанский университет',
		short_name: 'КГТУ',
		org_type: 'university',
		inn: '1655012344',
		custom_fields: {},
		external_ids: {},
		manual_overrides: [],
		version: 1,
		created_at: '',
		updated_at: '',
		...over
	}) as Organization;

describe('guessOrgType', () => {
	it('по ИНН и названию', () => {
		expect(guessOrgType('Иванов Иван Иванович', '165501234412')).toBe('individual_entrepreneur');
		expect(guessOrgType('Ростовский колледж связи', '6165012344')).toBe('college');
		expect(guessOrgType('Уфимский авиационный университет', '0278012344')).toBe('university');
		expect(guessOrgType('ООО «Цифровые кадры»', '7729012342')).toBe('company');
	});
});

describe('формы организации', () => {
	it('создание: пустые строки не уходят, число и тип уходят', () => {
		const body = toCreateBody({ ...emptyOrgForm(), inn: ' 1655012344 ', name: '', students_count: 120 });
		expect(body.inn).toBe('1655012344');
		expect(body.name).toBeUndefined();
		expect(body.students_count).toBe(120);
		expect(body.org_type).toBe('university');
	});
	it('правка: только изменённые поля, очищенное — null, ИНН не меняется', () => {
		const base = formFromOrg(org({ website: 'https://a.ru', kpp: '165501001' }));
		const body = toPatchBody(base, { ...base, website: '', kpp: '165501002', inn: '9999999999' });
		expect(body).toEqual({ website: null, kpp: '165501002' });
	});
});

describe('driftEntries', () => {
	it('форма бэкенда { поле: { old, new } }', () => {
		const list = driftEntries(org({ requisites_drift: { legal_address: { old: 'ул. А', new: 'ул. Б' } } }));
		expect(list).toEqual([{ field: 'legal_address', label: 'Юридический адрес', current: 'ул. А', next: 'ул. Б' }]);
	});
	it('форма «поле: новое значение» берёт текущее из карточки', () => {
		const list = driftEntries(org({ kpp: '165501001', requisites_drift: { kpp: '165502002' } }));
		expect(list[0]).toMatchObject({ field: 'kpp', current: '165501001', next: '165502002' });
	});
	it('статус в реестре читается словами', () => {
		const list = driftEntries(org({ requisites_drift: { registry_status: { old: null, new: 'liquidating' } } }));
		expect(list).toEqual([{ field: 'registry_status', label: 'Статус в ЕГРЮЛ', current: '—', next: 'Ликвидируется' }]);
	});
	it('нет расхождений — пустой список', () => {
		expect(driftEntries(org({ requisites_drift: null }))).toEqual([]);
	});
});

describe('пометки полей из реестра', () => {
	const verified = org({ verified_source: 'fns_registry', manual_overrides: ['kpp'] });
	it('поле из реестра — «из ЕГРЮЛ», исправленное руками — «изменено вручную»', () => {
		expect(registryMark(verified, 'short_name')).toBe('из ЕГРЮЛ');
		expect(registryMark(verified, 'kpp')).toBe('изменено вручную');
	});
	it('без сверки с реестром, без карточки и у прочих полей пометки нет', () => {
		expect(registryMark(org(), 'short_name')).toBeUndefined();
		expect(registryMark(null, 'short_name')).toBeUndefined();
		expect(registryMark(verified, 'website')).toBeUndefined();
	});
	it('пометка встаёт в название поля в скобках', () => {
		expect(markedLabel('Краткое название', 'из ЕГРЮЛ')).toBe('Краткое название (из ЕГРЮЛ)');
		expect(markedLabel('Сайт')).toBe('Сайт');
	});
});
