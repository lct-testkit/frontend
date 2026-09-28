import { describe, expect, it } from 'vitest';
import { activeCount, apiQuery, dayEnd, dayStart, emptyFilters, entityHref, exportFilename } from './audit-query';

describe('emptyFilters', () => {
	it('все поля — пустая строка', () => {
		expect(emptyFilters()).toEqual({ action: '', entity_type: '', result: '', actor_id: '', entity_id: '', request_id: '', from: '', to: '' });
	});
});

describe('dayStart / dayEnd', () => {
	it('начало и конец дня по локальному времени, пустая строка — undefined', () => {
		expect(dayStart('2026-09-20')).toBe(new Date('2026-09-20T00:00:00').toISOString());
		expect(dayEnd('2026-09-20')).toBe(new Date('2026-09-20T23:59:59.999').toISOString());
		expect(dayStart('')).toBeUndefined();
		expect(dayEnd('')).toBeUndefined();
	});
});

describe('apiQuery', () => {
	it('пустые поля не уходят в запрос', () => {
		expect(apiQuery(emptyFilters())).toEqual({
			action: undefined,
			entity_type: undefined,
			result: undefined,
			actor_id: undefined,
			entity_id: undefined,
			request_id: undefined,
			from: undefined,
			to: undefined
		});
	});

	it('actor_id/entity_id уходят только валидным uuid — иначе не отправляются (защита от случайного текста в фильтре)', () => {
		const uuid = '0192a1b2-3c4d-7e8f-9a0b-1c2d3e4f5a6b';
		expect(apiQuery({ ...emptyFilters(), actor_id: uuid }).actor_id).toBe(uuid);
		expect(apiQuery({ ...emptyFilters(), actor_id: 'not-a-uuid' }).actor_id).toBeUndefined();
		expect(apiQuery({ ...emptyFilters(), entity_id: uuid }).entity_id).toBe(uuid);
		expect(apiQuery({ ...emptyFilters(), entity_id: '123' }).entity_id).toBeUndefined();
	});

	it('от/до переводятся в границы дня', () => {
		const q = apiQuery({ ...emptyFilters(), from: '2026-03-01', to: '2026-03-31' });
		expect(q.from).toBe(dayStart('2026-03-01'));
		expect(q.to).toBe(dayEnd('2026-03-31'));
	});

	it('action/entity_type/result/request_id проходят как есть', () => {
		const q = apiQuery({ ...emptyFilters(), action: 'deal.created', entity_type: 'deal', result: 'success', request_id: 'req-1' });
		expect(q).toMatchObject({ action: 'deal.created', entity_type: 'deal', result: 'success', request_id: 'req-1' });
	});
});

describe('activeCount', () => {
	it('считает непустые поля', () => {
		expect(activeCount(emptyFilters())).toBe(0);
		expect(activeCount({ ...emptyFilters(), action: 'x' })).toBe(1);
		expect(activeCount({ ...emptyFilters(), action: 'x', result: 'success', from: '2026-01-01' })).toBe(3);
	});
});

describe('entityHref', () => {
	it('известные типы — своя ссылка', () => {
		expect(entityHref('deal', 'd1')).toBe('/deals/d1');
		expect(entityHref('organization', 'o1')).toBe('/organizations/o1');
		expect(entityHref('contact', 'c1')).toBe('/contacts/c1');
		expect(entityHref('user', 'u1')).toBe('/admin/users/u1');
		expect(entityHref('signature_document', 's1')).toBe('/signing/s1');
		expect(entityHref('data_erasure_request', 'e1')).toBe('/admin/erasure/e1');
		expect(entityHref('workflow', 'w1')).toBe('/workflows/w1');
		expect(entityHref('import_job', 'i1')).toBe('/imports/i1');
	});
	it('неизвестный тип, нет типа или нет id — null (у сущности нет своего экрана)', () => {
		expect(entityHref('file', 'f1')).toBeNull();
		expect(entityHref(null, 'd1')).toBeNull();
		expect(entityHref('deal', null)).toBeNull();
		expect(entityHref(undefined, undefined)).toBeNull();
	});
});

describe('exportFilename', () => {
	it('дата в имени файла — календарный день, без времени', () => {
		expect(exportFilename(new Date('2026-09-20T15:30:00Z'))).toBe('audit-2026-09-20.ndjson');
	});
});
