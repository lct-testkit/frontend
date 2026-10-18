import { describe, expect, it } from 'vitest';
import { activeCount, readFilters, sortToState, stateToSort, toQuery } from './dealFilters';

const params = (s: string) => new URLSearchParams(s);

describe('фильтры сделок в адресе', () => {
	it('читает параметры и знает значения по умолчанию', () => {
		const f = readFilters(params('view=board&quick=breached&q=КГТУ&type=b2b'));
		expect(f).toMatchObject({ view: 'board', quick: 'breached', q: 'КГТУ', type: 'b2b', workflow: '' });
		expect(readFilters(params('quick=что-то')).quick).toBe('all');
		expect(readFilters(params('')).view).toBe('table');
	});
	it('быстрые фильтры превращаются в параметры API', () => {
		expect(toQuery(readFilters(params('quick=mine')), 'me-1').owner_id).toEqual(['me-1']);
		expect(toQuery(readFilters(params('quick=mine&owner=other')), 'me-1').owner_id).toEqual(['other']);
		expect(toQuery(readFilters(params('quick=warning')), 'me-1').sla_state).toBe('warning');
		expect(toQuery(readFilters(params('quick=closed')), 'me-1').is_closed).toBe(true);
	});
	it('sort — сырой параметр API едет как есть, пустой не уходит в запрос', () => {
		expect(toQuery(readFilters(params('sort=-amount')), null).sort).toBe('-amount');
		expect(toQuery(readFilters(params('')), null).sort).toBeUndefined();
	});
	it('sortToState/stateToSort — только известные сортируемые колонки, обратимо', () => {
		expect(sortToState('-amount')).toEqual({ key: 'amount', dir: 'desc' });
		expect(sortToState('number')).toEqual({ key: 'number', dir: 'asc' });
		expect(sortToState('')).toBeNull();
		expect(sortToState('-status')).toBeNull(); // не колонка с sortable — сервер такого поля и не примет
		expect(stateToSort({ key: 'updated_at', dir: 'asc' })).toBe('updated_at');
		expect(stateToSort({ key: 'updated_at', dir: 'desc' })).toBe('-updated_at');
		expect(stateToSort(null)).toBe('');
	});
	it('период создания — границы дня, пустое не уходит', () => {
		const q = toQuery(readFilters(params('from=2026-03-01&to=2026-03-31&q=%20')), null);
		expect(q.created_from).toBeDefined();
		expect(new Date(q.created_to!).getTime()).toBeGreaterThan(new Date(q.created_from!).getTime());
		expect(q.q).toBeUndefined();
	});
	it('считает включённые фильтры панели', () => {
		expect(activeCount(readFilters(params('type=b2b&priority=high&from=2026-03-01')))).toBe(3);
		expect(activeCount(readFilters(params('owner=x')), true)).toBe(0);
	});
	it('несколько статусов: status=a,b и повторяющийся status читаются массивом, старая ссылка status=a — тоже', () => {
		expect(readFilters(params('status=a,b')).statuses).toEqual(['a', 'b']);
		expect(readFilters(params('status=a&status=b')).statuses).toEqual(['a', 'b']);
		expect(readFilters(params('status=a')).statuses).toEqual(['a']);
		expect(readFilters(params('')).statuses).toEqual([]);
	});
	it('toQuery: статусы — повторяемый status_id, пустые не уходят; вуз и направление — organization_id и direction_id', () => {
		expect(toQuery(readFilters(params('status=a,b')), null).status_id).toEqual(['a', 'b']);
		expect(toQuery(readFilters(params('')), null).status_id).toBeUndefined();
		const q = toQuery(readFilters(params('organization=o1&direction=d1')), null);
		expect(q.organization_id).toEqual(['o1']);
		expect(q.direction_id).toEqual(['d1']);
		expect(toQuery(readFilters(params('')), null).organization_id).toBeUndefined();
	});
	it('параметр org (форма «Новая сделка») фильтром по вузу не становится', () => {
		const f = readFilters(params('new=1&org=x&contact=y'));
		expect(f.organization).toBe('');
		expect(toQuery(f, null).organization_id).toBeUndefined();
		expect(activeCount(f)).toBe(0);
	});
	it('activeCount: +1 за вуз, +1 за направление, +1 за любое число статусов', () => {
		expect(activeCount(readFilters(params('organization=o')))).toBe(1);
		expect(activeCount(readFilters(params('organization=o&direction=d')))).toBe(2);
		expect(activeCount(readFilters(params('status=a,b,c')))).toBe(1);
		expect(activeCount(readFilters(params('organization=o&direction=d&status=a,b')))).toBe(3);
	});
});
