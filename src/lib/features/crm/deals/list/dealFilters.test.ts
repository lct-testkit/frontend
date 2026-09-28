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
		expect(toQuery(readFilters(params('quick=mine')), 'me-1').owner_id).toBe('me-1');
		expect(toQuery(readFilters(params('quick=mine&owner=other')), 'me-1').owner_id).toBe('other');
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
});
