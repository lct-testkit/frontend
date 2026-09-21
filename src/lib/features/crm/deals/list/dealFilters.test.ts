import { describe, expect, it } from 'vitest';
import { activeCount, readFilters, toQuery } from './dealFilters';

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
		expect(toQuery(readFilters(params('quick=closed')), 'me-1').closed_from).toBe('1970-01-01T00:00:00Z');
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
