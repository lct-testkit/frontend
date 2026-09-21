import { describe, expect, it } from 'vitest';
import type { AvailableTransition, WorkflowGraph, WorkflowStatus } from '../types';
import { classifyTransitions, isTerminal, steps, terminals, transitionKind } from './statusUtils';

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
