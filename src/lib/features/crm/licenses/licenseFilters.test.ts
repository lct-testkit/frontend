import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeCount, moreCount, patchFor, readFilters, toQuery, toReportParams, yearOptions, type LicenseFilters } from './licenseFilters';

const ID = '01a14ec0-8bbb-7000-b2fa-f9b3bdb7342d';
const read = (s: string) => readFilters(new URLSearchParams(s));
const withFilters = (over: Partial<LicenseFilters>): LicenseFilters => ({ ...EMPTY_FILTERS, ...over });

describe('readFilters', () => {
	it('мусор в адресе читается как пустое значение', () => {
		expect(read('status=foo&year=20266&signed=maybe&org=abc&vendor=1&product=x')).toEqual(EMPTY_FILTERS);
	});

	it('корректные значения читаются как есть', () => {
		expect(read(`q=%20Астра%20&org=${ID}&vendor=${ID}&product=${ID}&status=in_progress,transferred&year=2027&signed=yes`)).toEqual({
			q: 'Астра',
			org: ID,
			vendor: ID,
			product: ID,
			status: ['in_progress', 'transferred'],
			year: '2027',
			signed: 'yes'
		});
	});

	it('в списке статусов неизвестные и повторы отбрасываются', () => {
		expect(read('status=declined,foo,declined').status).toEqual(['declined']);
	});
});

describe('toQuery', () => {
	it('пустые фильтры дают пустой объект', () => {
		expect(toQuery(EMPTY_FILTERS)).toEqual({});
	});

	it('пробелы в поиске обрезаются, пустой поиск не уходит', () => {
		expect(toQuery(withFilters({ q: '  мгу ' }))).toEqual({ q: 'мгу' });
		expect(toQuery(withFilters({ q: '   ' }))).toEqual({});
	});

	it('все поля превращаются в параметры сервера', () => {
		expect(toQuery(withFilters({ org: ID, vendor: ID, product: ID, status: ['declined'], year: '2026', signed: 'no' }))).toEqual({
			organization_id: ID,
			vendor_id: ID,
			product_id: ID,
			transfer_status: ['declined'],
			year: 2026,
			is_signed: false
		});
	});
});

describe('activeCount', () => {
	it('считает вуз, вендор, ПО, статус, год, подписание; не считает поиск', () => {
		expect(activeCount(withFilters({ q: 'мгу' }))).toBe(0);
		expect(activeCount(withFilters({ org: ID, vendor: ID, product: ID, status: ['a'], year: '2026', signed: 'yes' }))).toBe(6);
	});

	it('статус из нескольких значений — один фильтр', () => {
		expect(activeCount(withFilters({ status: ['in_progress', 'declined'] }))).toBe(1);
	});

	it('moreCount — только поля панели «Фильтры» (ПО, статус, год, подписание)', () => {
		expect(moreCount(withFilters({ org: ID, vendor: ID, product: ID, status: ['a'], year: '2026' }))).toBe(3);
	});
});

describe('patchFor', () => {
	it('смена вендора сбрасывает ПО', () => {
		expect(patchFor({ vendor: 'v2' }, withFilters({ vendor: 'v1', product: 'p1' }))).toEqual({ vendor: 'v2', product: null });
	});

	it('повторный выбор того же вендора ПО не сбрасывает', () => {
		expect(patchFor({ vendor: 'v1' }, withFilters({ vendor: 'v1', product: 'p1' }))).toEqual({ vendor: 'v1' });
	});

	it('очистка вендора сбрасывает ПО; явно заданное ПО остаётся', () => {
		expect(patchFor({ vendor: '' }, withFilters({ vendor: 'v1', product: 'p1' }))).toEqual({ vendor: null, product: null });
		expect(patchFor({ vendor: 'v2', product: 'p9' }, withFilters({ vendor: 'v1' }))).toEqual({ vendor: 'v2', product: 'p9' });
	});

	it('статусы склеиваются через запятую, пустой список убирает параметр', () => {
		expect(patchFor({ status: ['a', 'b'] }, EMPTY_FILTERS)).toEqual({ status: 'a,b' });
		expect(patchFor({ status: [] }, EMPTY_FILTERS)).toEqual({ status: null });
	});
});

describe('yearOptions', () => {
	it('от текущего года минус 3 до плюс 6, новые сверху', () => {
		const years = yearOptions(new Date(2026, 9, 18)).map((o) => o.key);
		expect(years[0]).toBe('2032');
		expect(years.at(-1)).toBe('2023');
		expect(years).toHaveLength(10);
	});
});

describe('toReportParams', () => {
	it('без фильтров — пусто', () => {
		expect(toReportParams(EMPTY_FILTERS)).toEqual({});
	});

	it('вуз, вендор по названию и статусы переходят в параметры отчёта', () => {
		expect(toReportParams(withFilters({ org: ID, vendor: 'v1', status: ['in_progress', 'declined'] }), 'ООО «Астра Линукс»')).toEqual({
			organization_ids: [ID],
			vendors: ['ООО «Астра Линукс»'],
			transfer_statuses: ['in_progress', 'declined']
		});
	});

	it('вендор без известного названия не передаётся; поиск, ПО, год, подписание отчёт не принимает', () => {
		expect(toReportParams(withFilters({ vendor: 'v1', product: 'p1', year: '2027', signed: 'yes', q: 'мгу' }), null)).toEqual({});
	});
});
