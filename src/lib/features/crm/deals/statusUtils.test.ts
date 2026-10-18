import { describe, expect, it } from 'vitest';
import type { AvailableTransition, WorkflowGraph, WorkflowStatus } from '../types';
import { funnel14, stepId } from '../../config/workflows/fixtures/workflow14';
import { classifyTransitions, isTerminal, optionalStepIds, roleHint, roleList, statusName, stepStates, steps, terminals, transitionKind } from './statusUtils';

const st = (id: string, type: string, sort: number, extra: Partial<WorkflowStatus> = {}): WorkflowStatus => ({
	id,
	code: id,
	name: id,
	type,
	sort_order: sort,
	required_fields: [],
	is_archived: false,
	...extra
});

const graph = {
	statuses: [
		st('c', 'intermediate', 30),
		st('won', 'won', 1000),
		st('a', 'initial', 10),
		st('lost', 'lost', 1010),
		st('b', 'intermediate', 20),
		st('old', 'intermediate', 15, { is_archived: true }),
		st('parked', 'parked', 1020)
	]
} as unknown as WorkflowGraph;

const tr = (id: string, to: string, over: Partial<AvailableTransition> = {}): AvailableTransition => ({
	id,
	name: id,
	to_status_id: to,
	requires_comment: false,
	role_allowed: true,
	satisfied: true,
	conditions: [],
	...over
});

describe('steps / terminals', () => {
	it('шаги — по порядку, без архивных и терминальных', () => {
		expect(steps(graph).map((s) => s.id)).toEqual(['a', 'b', 'c']);
	});
	it('терминальные — успех, отказ, заморозка', () => {
		expect(terminals(graph).map((s) => s.id)).toEqual(['won', 'lost', 'parked']);
		expect(isTerminal(st('x', 'lost', 1))).toBe(true);
		expect(isTerminal(st('x', 'intermediate', 1))).toBe(false);
	});
});

describe('transitionKind', () => {
	const current = st('b', 'intermediate', 20);
	it('вперёд, назад и терминальные', () => {
		expect(transitionKind(st('c', 'intermediate', 30), current)).toBe('forward');
		expect(transitionKind(st('a', 'initial', 10), current)).toBe('back');
		expect(transitionKind(st('won', 'won', 1000), current)).toBe('won');
		expect(transitionKind(st('lost', 'lost', 1010), current)).toBe('lost');
		expect(transitionKind(st('parked', 'parked', 1020), current)).toBe('parked');
	});
});

describe('classifyTransitions', () => {
	const byId = new Map(graph.statuses.map((s) => [s.id, s]));
	const statusOf = (id: string) => byId.get(id);
	const current = byId.get('b');

	it('главная — первый переход вперёд; заморозка и отказ — рядом; возврат — в меню', () => {
		const res = classifyTransitions([tr('fwd', 'c'), tr('back', 'a'), tr('lost', 'lost'), tr('park', 'parked')], statusOf, current);
		expect(res.primary?.transition.id).toBe('fwd');
		expect(res.secondary.map((c) => c.transition.id)).toEqual(['lost', 'park']);
		expect(res.more.map((c) => c.transition.id)).toEqual(['back']);
	});
	it('на последнем шаге главная — «успешно закрыть»', () => {
		const res = classifyTransitions([tr('won', 'won'), tr('lost', 'lost')], statusOf, byId.get('c'));
		expect(res.primary?.transition.id).toBe('won');
	});
	it('переходы, недоступные роли, уходят в меню и не становятся главными', () => {
		const res = classifyTransitions([tr('fwd', 'c', { role_allowed: false })], statusOf, current);
		expect(res.primary).toBeNull();
		expect(res.more).toHaveLength(1);
	});
});

describe('statusName', () => {
	it('первая буква заглавная, остальное как есть', () => {
		expect(statusName('на паузе')).toBe('На паузе');
		expect(statusName('Заморожена')).toBe('Заморожена');
		expect(statusName('  отказ ')).toBe('Отказ');
		expect(statusName(null)).toBe('');
	});
});

describe('roleHint', () => {
	const g = (roles: string[]) => ({ transitions: [{ id: 't1', allowed_roles: roles }] }) as unknown as WorkflowGraph;
	it('HEAD → «Руководитель, Администратор»', () => expect(roleHint({ id: 't1' }, g(['HEAD']))).toBe('Руководитель, Администратор'));
	it('пустой список ролей и неизвестный переход → null', () => {
		expect(roleHint({ id: 't1' }, g([]))).toBeNull();
		expect(roleHint({ id: 'zz' }, g(['HEAD']))).toBeNull();
		expect(roleHint({ id: 't1' }, undefined)).toBeNull();
	});
	it('администратор не дублируется', () => expect(roleHint({ id: 't1' }, g(['HEAD', 'ADMIN']))).toBe('Руководитель, Администратор'));
	it('roleList из ответа сервера', () => expect(roleList(['HEAD'])).toBe('Руководитель, Администратор'));
});

describe('воронка из 14 шагов', () => {
	const g = funnel14();
	const byId = new Map(g.statuses.map((x) => [x.id, x]));
	const statusOf = (id: string) => byId.get(id);
	const list = steps(g);
	const available = (from: string) => g.transitions.filter((t) => t.from_status_id === from).map((t) => tr(t.id, t.to_status_id, { name: t.name }));

	it('фикстура: 17 статусов, 71 переход, 14 шагов по порядку', () => {
		expect(g.statuses).toHaveLength(17);
		expect(g.transitions).toHaveLength(71);
		expect(list.map((s) => s.id)).toEqual(Array.from({ length: 14 }, (_, i) => stepId(i + 1)));
	});

	describe('optionalStepIds', () => {
		it('необязателен шаг, который можно обойти переходом 4 → 6', () => {
			expect([...optionalStepIds(g)]).toEqual([stepId(5)]);
		});
		it('без перехода «через шаг» необязательных нет', () => {
			expect(optionalStepIds(funnel14({ optionalStep5: false })).size).toBe(0);
		});
		it('пустой граф и ничего', () => {
			expect(optionalStepIds(undefined).size).toBe(0);
		});
	});

	describe('transitionKind', () => {
		it('через шаг — skip, на ближний — forward, из заморозки — resume (а не back)', () => {
			expect(transitionKind(statusOf('s6'), statusOf('s4'), list)).toBe('skip');
			expect(transitionKind(statusOf('s5'), statusOf('s4'), list)).toBe('forward');
			expect(transitionKind(statusOf('s4'), statusOf('s6'), list)).toBe('back');
			expect(transitionKind(statusOf('s8'), statusOf('parked'), list)).toBe('resume');
		});
		it('без списка шагов «через шаг» не отличить: forward', () => {
			expect(transitionKind(statusOf('s6'), statusOf('s4'))).toBe('forward');
		});
	});

	describe('classifyTransitions', () => {
		it('с шага 4 главная — ближний шаг 5, «через шаг» — в меню', () => {
			const res = classifyTransitions(available('s4'), statusOf, statusOf('s4'), { steps: list });
			expect(res.primary?.target?.id).toBe('s5');
			expect(res.more.find((c) => c.kind === 'skip')?.target?.id).toBe('s6');
			expect(res.secondary.map((c) => c.kind).sort()).toEqual(['lost', 'parked']);
		});
		it('у замороженной главная — «возобновить» на шаг остановки, остальные 13 — в меню, «назад» нет', () => {
			const res = classifyTransitions(available('parked'), statusOf, statusOf('parked'), { steps: list, stoppedAt: 's8' });
			expect(res.primary?.kind).toBe('resume');
			expect(res.primary?.target?.id).toBe('s8');
			expect(res.more).toHaveLength(13);
			expect(res.more.every((c) => c.kind === 'resume')).toBe(true);
		});
		it('шаг остановки неизвестен — главной нет, все 14 в меню', () => {
			const res = classifyTransitions(available('parked'), statusOf, statusOf('parked'), { steps: list });
			expect(res.primary).toBeNull();
			expect(res.more).toHaveLength(14);
		});
	});

	describe('stepStates', () => {
		const optional = optionalStepIds(g);
		const at = (n: number) => n - 1;
		it('пропуск шага 5: слева от шага 6 он «skipped», остальные «done»', () => {
			const res = stepStates(list, at(6), new Set(['s1', 's2', 's3', 's4', 's6']), optional, false);
			expect(res[at(5)]).toBe('skipped');
			expect(res.filter((x) => x === 'done')).toHaveLength(4);
			expect(res[at(6)]).toBe('current');
			expect(res.slice(6).every((x) => x === 'future')).toBe(true);
		});
		it('шаг 5 посещён — он «done»', () => {
			expect(stepStates(list, at(6), new Set(['s5']), optional, false)[at(5)]).toBe('done');
		});
		it('возврат 8 → 6: шаги 7 и 8 справа — «earlier», дальше «future»', () => {
			const res = stepStates(list, at(6), new Set(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']), optional, false);
			expect(res.slice(6, 8)).toEqual(['earlier', 'earlier']);
			expect(res[at(9)]).toBe('future');
		});
		it('перенос на другую воронку: пропусков нет', () => {
			const res = stepStates(list, at(8), new Set(['s8']), optional, false, true);
			expect(res[at(5)]).toBe('done');
		});
		it('остановленная сделка: «stopped» на шаге остановки; шаг остановки неизвестен — всё «future»', () => {
			expect(stepStates(list, at(8), new Set(), optional, true)[at(8)]).toBe('stopped');
			expect(stepStates(list, -1, new Set(['s1']), optional, true).every((x) => x === 'future')).toBe(true);
		});
		it('успешно закрытая (индекс за последним): все слева, обойдённый необязательный — пропущен', () => {
			const res = stepStates(list, list.length, new Set(), optional, false);
			expect(res[at(5)]).toBe('skipped');
			expect(res.filter((x) => x === 'done')).toHaveLength(13);
		});
	});
});
