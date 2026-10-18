import { describe, expect, it } from 'vitest';
import type { Workflow } from '../types';
import { cleanRoute, describeRoute, emptyRuleDraft, mapRoutingIssues, ruleToDraft, routeWarnings, splitList, statusOptions, toRouting, validateRouting, workflowOptions, EMPTY_ROUTE } from './routing';

const wf = (code: string, patch: Partial<Workflow> = {}): Workflow => ({ code, name: `Воронка ${code}`, deal_type: 'b2b', state: 'published', is_default: false, id: code, ...patch }) as Workflow;
const st = (code: string, sort_order: number, type = 'intermediate', is_archived = false) => ({ code, name: `Шаг ${code}`, type, sort_order, is_archived });

describe('варианты воронок и статусов', () => {
	const list = [wf('a'), wf('b', { is_default: true }), wf('c', { state: 'archived' }), wf('d', { deal_type: 'b2c' }), wf('e', { state: 'draft' })];
	it('только опубликованные воронки нужного типа, по умолчанию — первой', () => {
		expect(workflowOptions(list, 'b2b').map((o) => o.key)).toEqual(['b', 'a']);
		expect(workflowOptions(list, 'b2b')[0].value).toMatch(/по умолчанию/);
		expect(workflowOptions(list, 'b2c').map((o) => o.key)).toEqual(['d']);
	});
	it('статусы графа из 14 шагов по порядку, без архивных и без итоговых', () => {
		const graph = [...Array.from({ length: 14 }, (_, i) => st(`s${i}`, (14 - i) * 10, i === 0 ? 'initial' : 'intermediate')), st('won', 5, 'won'), st('old', 1, 'intermediate', true)];
		const opts = statusOptions(graph);
		expect(opts).toHaveLength(14);
		expect(opts[0].key).toBe('s13');
		expect(opts.some((o) => o.key === 'won' || o.key === 'old')).toBe(false);
	});
});

describe('routeWarnings', () => {
	const list = [wf('pub'), wf('arch', { state: 'archived' }), wf('kid', { deal_type: 'b2c' })];
	const route = (patch: object) => ({ ...EMPTY_ROUTE, deal_type: 'b2b' as const, ...patch });
	it('архивная, отсутствующая воронка и несовпадение типа', () => {
		expect(routeWarnings(route({ workflow_code: 'arch' }), list, null)[0]).toMatch(/не опубликована/);
		expect(routeWarnings(route({ workflow_code: 'gone' }), list, null)[0]).toMatch(/нет/);
		expect(routeWarnings(route({ workflow_code: 'kid' }), list, null)[0]).toMatch(/Тип воронки/);
		expect(routeWarnings(route({ workflow_code: 'pub' }), list, null)).toEqual([]);
	});
	it('статус, которого нет в графе', () => {
		const graph = [st('a', 1, 'initial'), st('b', 2)];
		expect(routeWarnings(route({ workflow_code: 'pub', initial_status_code: 'zzz' }), list, graph)[0]).toMatch(/Выбранного статуса нет/);
		expect(routeWarnings(route({ workflow_code: 'pub', initial_status_code: 'b' }), list, graph)).toEqual([]);
	});
});

describe('describeRoute', () => {
	it('пустой маршрут — по умолчанию; с воронкой и статусом — по названиям', () => {
		expect(describeRoute(null, [])).toBe('B2C, воронка по умолчанию');
		expect(describeRoute({ ...EMPTY_ROUTE, deal_type: 'b2b', workflow_code: 'x', initial_status_code: 's1' }, [wf('x', { name: 'Вузы' })], [st('s1', 1)])).toBe('B2B, воронка «Вузы», статус «Шаг s1»');
	});
});

describe('перевод в тело PUT и обратно', () => {
	it('«конкретный менеджер» несёт id, другие политики — нет; пустое становится null', () => {
		expect(cleanRoute({ ...EMPTY_ROUTE, workflow_code: '', owner_policy: 'fixed', fixed_owner_id: 'u1' })).toMatchObject({ workflow_code: null, fixed_owner_id: 'u1' });
		expect(cleanRoute({ ...EMPTY_ROUTE, owner_policy: 'least_loaded', fixed_owner_id: 'u1' }).fixed_owner_id).toBeNull();
	});
	it('«равно» и «одно из»', () => {
		const eq = { ...emptyRuleDraft(), target: 'lead_kind', value: ' university ' };
		const inn = { ...emptyRuleDraft(), target: 'lead_kind', op: 'in' as const, value: 'university, vuz,' };
		const r = toRouting(EMPTY_ROUTE, [eq, inn]);
		expect(r.rules?.[0].when).toEqual({ target: 'lead_kind', equals: 'university' });
		expect(r.rules?.[1].when).toEqual({ target: 'lead_kind', in: ['university', 'vuz'] });
		expect(ruleToDraft(r.rules![1])).toMatchObject({ op: 'in', value: 'university, vuz' });
	});
	it('splitList', () => expect(splitList('a, ,b')).toEqual(['a', 'b']));
});

describe('validateRouting', () => {
	it('конкретный менеджер без менеджера, правило без поля и значения', () => {
		const v = validateRouting({ ...EMPTY_ROUTE, owner_policy: 'fixed' }, [emptyRuleDraft()]);
		expect(v.def.owner).toBeTruthy();
		expect(v.rules[0]).toMatchObject({ target: expect.any(String), value: expect.any(String) });
		expect(validateRouting(EMPTY_ROUTE, [])).toEqual({ def: {}, rules: [] });
	});
});

describe('mapRoutingIssues', () => {
	it('поля маршрута раскладываются, остальное — общим списком', () => {
		const r = mapRoutingIssues([
			{ field: 'rules[0].route.workflow_code', reason: 'воронка не опубликована' },
			{ field: 'default.initial_status_code', reason: 'статус не найден' },
			{ field: 'rules[1].when.target', reason: 'неизвестная цель' },
			{ field: 'rules', reason: 'не больше 10 правил' }
		]);
		expect(r.rules[0].workflow).toBe('воронка не опубликована');
		expect(r.def.status).toBe('статус не найден');
		expect(r.rules[1].target).toBe('неизвестная цель');
		expect(r.form).toEqual(['не больше 10 правил']);
	});
});
