import { describe, expect, it } from 'vitest';
import type { Condition } from './dsl';
import {
	fromServer,
	layoutByLevels,
	makeCode,
	newStatus,
	newTransition,
	removeStatus,
	toFlow,
	toServer,
	transliterate,
	type GraphDraft,
	type ServerGraph,
	type StatusDraft,
	type TransitionDraft
} from './graph';
import { hasErrors, parseServerIssues, transitionIssues, validateGraph } from './validation';

// Код на сервере — минимум 2 символа, поэтому однобуквенные ключи получают префикс.
const status = (key: string, type: StatusDraft['type'] = 'intermediate', extra: Partial<StatusDraft> = {}): StatusDraft => ({
	key,
	id: extra.id === undefined ? key : extra.id,
	code: key.length > 1 ? key : `s_${key}`,
	name: extra.name ?? key,
	type,
	color: null,
	sort_order: 0,
	required_fields: [],
	is_archived: false,
	archived_at: null,
	replaced_by_status_id: null,
	...extra
});
const transition = (from: string, to: string, extra: Partial<TransitionDraft> = {}): TransitionDraft => ({
	key: `${from}->${to}`,
	id: `${from}->${to}`,
	from,
	to,
	name: extra.name ?? `${from}->${to}`,
	allowed_roles: [],
	conditions: {},
	actions: [],
	requires_comment: false,
	sort_order: 0,
	...extra
});
const draftOf = (statuses: StatusDraft[], transitions: TransitionDraft[]): GraphDraft => ({ statuses, transitions, sla_rules: [] });

const SERVER: ServerGraph = {
	statuses: [
		{ id: 's1', code: 'first', name: 'Первый', type: 'initial', sort_order: 10, required_fields: [], is_archived: false },
		{ id: 's2', code: 'second', name: 'Второй', type: 'intermediate', sort_order: 20, required_fields: ['amount'], is_archived: false, color: '#f00' },
		{ id: 'won', code: 'won', name: 'Успех', type: 'won', sort_order: 1000, required_fields: [], is_archived: false },
		{ id: 'old', code: 'old', name: 'Старый', type: 'intermediate', sort_order: 15, required_fields: [], is_archived: true, archived_at: '2026-01-01T00:00:00Z', replaced_by_status_id: 's2' }
	],
	transitions: [
		{ id: 't1', from_status_id: 's1', to_status_id: 's2', name: 'Дальше', allowed_roles: [], conditions: {}, actions: [], requires_comment: false, sort_order: 10 },
		{ id: 't2', from_status_id: 's2', to_status_id: 'won', name: 'Закрыть', allowed_roles: ['HEAD'], conditions: { field: 'amount', op: 'not_null' }, actions: [], requires_comment: true, sort_order: 10 },
		{ id: 't3', from_status_id: 's1', to_status_id: 'old', name: 'В старый', allowed_roles: [], conditions: {}, actions: [], requires_comment: false, sort_order: 30 }
	],
	sla_rules: [{ id: 'r1', status_id: 's2', max_duration_hours: 48, warn_threshold_pct: 80, channels: ['in_app'], count_business_days: true, is_active: true }]
};

describe('fromServer / toServer', () => {
	it('черновик из серверного графа сохраняет id как ключи', () => {
		const draft = fromServer(SERVER);
		expect(draft.statuses.map((s) => s.key)).toEqual(['s1', 's2', 'won', 'old']);
		expect(draft.transitions[1]).toMatchObject({ from: 's2', to: 'won', requires_comment: true });
		expect(draft.sla_rules[0]).toMatchObject({ status: 's2', max_duration_hours: 48 });
	});

	it('в тело PUT не попадают архивные статусы и их переходы, новые статусы ссылаются кодом', () => {
		const draft = fromServer(SERVER);
		const fresh = newStatus(draft, { name: 'Согласование КП' });
		draft.statuses.push(fresh);
		draft.transitions.push(newTransition(draft, 's2', fresh.key));
		draft.sla_rules.push({ key: 'x', status: fresh.key, max_duration_hours: 24, warn_threshold_pct: 80, escalate_to_role: null, escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true });

		const payload = toServer(draft);
		expect(payload.statuses.map((s) => s.code)).toEqual(['first', 'second', 'won', 'soglasovanie_kp']);
		expect(payload.statuses[0]).toMatchObject({ id: 's1', is_archived: false });
		expect(payload.statuses[3]).not.toHaveProperty('id');
		expect(payload.transitions.map((t) => [t.from_status, t.to_status])).toEqual([
			['s1', 's2'],
			['s2', 'won'],
			['s2', 'soglasovanie_kp']
		]);
		expect(payload.transitions[2].name).toBe('Перейти к статусу «Согласование КП»');
		expect(payload.sla_rules.map((r) => r.status)).toEqual(['s2', 'soglasovanie_kp']);
	});

	it('removeStatus убирает переходы и SLA', () => {
		const draft = removeStatus(fromServer(SERVER), 's2');
		expect(draft.statuses.map((s) => s.key)).toEqual(['s1', 'won', 'old']);
		expect(draft.transitions.map((t) => t.key)).toEqual(['t3']);
		expect(draft.sla_rules).toEqual([]);
	});
});

describe('makeCode', () => {
	it('транслитерирует и делает уникальным', () => {
		expect(transliterate('Юридическое согласование')).toBe('yuridicheskoe soglasovanie');
		expect(makeCode('Согласование КП', ['x'])).toBe('soglasovanie_kp');
		expect(makeCode('Согласование КП', ['soglasovanie_kp', 'soglasovanie_kp_2'])).toBe('soglasovanie_kp_3');
		expect(makeCode('123', [])).toBe('status_123');
		expect(makeCode('', [])).toBe('status');
		expect(makeCode('Я', [])).toBe('ya');
	});
});

describe('layoutByLevels', () => {
	it('линейная воронка — уровни слева направо, терминальные в последнем столбце, архивные правее', () => {
		const positions = layoutByLevels(fromServer(SERVER), { colGap: 100, rowGap: 50 });
		expect(positions.s1.x).toBe(0);
		expect(positions.s2.x).toBe(100);
		expect(positions.won.x).toBe(200);
		expect(positions.old.x).toBe(300);
	});

	it('недостижимые статусы попадают в столбец перед терминальными', () => {
		const draft = draftOf([status('a', 'initial'), status('b'), status('orphan'), status('won', 'won')], [transition('a', 'b'), transition('b', 'won')]);
		const positions = layoutByLevels(draft, { colGap: 100, rowGap: 50 });
		expect(positions.orphan.x).toBe(200);
		expect(positions.won.x).toBe(300);
	});

	it('несколько статусов на уровне центрируются по вертикали', () => {
		const draft = draftOf([status('a', 'initial'), status('b'), status('c'), status('won', 'won')], [transition('a', 'b'), transition('a', 'c'), transition('b', 'won'), transition('c', 'won')]);
		const positions = layoutByLevels(draft, { colGap: 100, rowGap: 50 });
		expect([positions.b.y, positions.c.y].sort((x, y) => x - y)).toEqual([-25, 25]);
		expect(positions.a.y).toBe(0);
	});
});

describe('toFlow', () => {
	it('строит узлы и рёбра с признаками условий/действий', () => {
		const draft = fromServer(SERVER);
		const { nodes, edges } = toFlow(draft, layoutByLevels(draft), [], { readonly: false });
		expect(nodes.map((n) => n.id)).toEqual(['s1', 's2', 'won', 'old']);
		expect(nodes[3].draggable).toBe(false);
		expect(nodes[1].data.sla?.max_duration_hours).toBe(48);
		const closing = edges.find((e) => e.id === 't2');
		expect(closing?.data).toMatchObject({ hasConditions: true, restricted: true, requiresComment: true, hasActions: false });
		expect(edges.find((e) => e.id === 't1')?.data?.hasConditions).toBe(false);
	});

	it('без архивных статусов их рёбра тоже скрыты', () => {
		const { nodes, edges } = toFlow(fromServer(SERVER), {}, [], { includeArchived: false });
		expect(nodes).toHaveLength(3);
		expect(edges.map((e) => e.id)).toEqual(['t1', 't2']);
	});
});

describe('validateGraph (зеркало _validate_graph_data)', () => {
	it('ровно один начальный и хотя бы один терминальный', () => {
		const two = draftOf([status('a', 'initial'), status('b', 'initial'), status('won', 'won')], [transition('a', 'won'), transition('b', 'won')]);
		expect(validateGraph(two).find((i) => i.code === 'initial_count')?.statusKeys).toEqual(['a', 'b']);
		const none = draftOf([status('a', 'initial'), status('b')], [transition('a', 'b')]);
		expect(validateGraph(none).map((i) => i.code)).toContain('no_terminal');
	});

	it('недостижимые статусы и ловушки привязаны к узлам', () => {
		const draft = draftOf([status('a', 'initial'), status('b'), status('orphan'), status('trap'), status('won', 'won')], [transition('a', 'b'), transition('b', 'won'), transition('a', 'trap')]);
		const issues = validateGraph(draft);
		expect(issues.filter((i) => i.code === 'unreachable').flatMap((i) => i.statusKeys)).toEqual(['orphan']);
		// orphan тоже ловушка: из него нет пути в завершающий статус (так же считает сервер)
		expect(issues.filter((i) => i.code === 'trap').flatMap((i) => i.statusKeys)).toEqual(['orphan', 'trap']);
		expect(hasErrors(issues)).toBe(true);
	});

	it('архивный статус не участвует в проверках', () => {
		const draft = draftOf([status('a', 'initial'), status('won', 'won'), status('old', 'intermediate', { is_archived: true })], [transition('a', 'won'), transition('a', 'old')]);
		expect(validateGraph(draft).filter((i) => i.severity === 'error')).toEqual([]);
	});

	it('петли, дубли переходов и кодов, плохой код', () => {
		const draft = draftOf(
			[status('a', 'initial'), status('b', 'intermediate', { code: 's_a' }), status('won', 'won', { code: 'Won!' })],
			[transition('a', 'a'), transition('a', 'won'), transition('a', 'won', { key: 'dup', id: 'dup' }), transition('b', 'won')]
		);
		const codes = validateGraph(draft).map((i) => i.code);
		expect(codes).toEqual(expect.arrayContaining(['self_loop', 'duplicate_transition', 'duplicate_code', 'bad_code']));
	});

	it('ошибки DSL и on_rejected попадают в переход, предупреждения — про отказ и успех', () => {
		const bad = transition('a', 'b', {
			conditions: { field: 'nope', op: 'eq', value: 1 },
			actions: [{ type: 'request_signature', template: 'x', signers: [{ role: 'HEAD' }], on_rejected: 'no_such' }]
		});
		const draft = draftOf([status('a', 'initial'), status('b'), status('won', 'won'), status('lost', 'lost')], [bad, transition('b', 'won'), transition('b', 'lost')]);
		const issues = validateGraph(draft);
		expect(issues.filter((i) => i.transitionKeys.includes('a->b') && i.severity === 'error').map((i) => i.code)).toEqual(['condition', 'action']);
		expect(issues.find((i) => i.code === 'lost_without_reason')?.transitionKeys).toEqual(['b->lost']);
		expect(issues.find((i) => i.code === 'won_without_conditions')?.transitionKeys).toEqual(['b->won']);
	});

	it('сидовая воронка без ошибок и предупреждений', () => {
		const lostGuard: Condition = { field: 'loss_reason_id', op: 'not_null' };
		const wonGuard: Condition = { all: [{ field: 'amount', op: 'not_null' }, { field: 'expected_close_date', op: 'not_null' }] };
		const draft = draftOf(
			[status('a', 'initial'), status('b'), status('won', 'won'), status('lost', 'lost')],
			[transition('a', 'b'), transition('b', 'won', { conditions: wonGuard }), transition('a', 'lost', { requires_comment: true, conditions: lostGuard }), transition('b', 'lost', { requires_comment: true, conditions: lostGuard })]
		);
		draft.sla_rules.push({ key: 'r', status: 'b', max_duration_hours: 72, warn_threshold_pct: 80, escalate_to_role: 'HEAD', escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true });
		expect(validateGraph(draft)).toEqual([]);
	});

	it('SLA: границы и дубли активных правил', () => {
		const draft = draftOf([status('a', 'initial'), status('won', 'won')], [transition('a', 'won')]);
		const rule = { key: 'r', status: 'a', max_duration_hours: 0, warn_threshold_pct: 150, escalate_to_role: null, escalate_to_user_id: null, channels: [], count_business_days: true, is_active: true };
		draft.sla_rules.push(rule, { ...rule, key: 'r2', max_duration_hours: 10, warn_threshold_pct: 50 });
		const codes = validateGraph(draft).map((i) => i.code);
		expect(codes.filter((c) => c === 'sla_invalid')).toHaveLength(2);
		expect(codes).toContain('sla_duplicate');
	});

	it('transitionIssues — точечная проверка для панели свойств', () => {
		const draft = draftOf([status('a', 'initial'), status('won', 'won')], []);
		expect(transitionIssues(transition('a', 'a', { name: ' ' }), draft)).toEqual(['Укажите название перехода', 'Переход не может вести в тот же статус']);
		expect(transitionIssues(transition('a', 'won'), draft)).toEqual([]);
	});
});

describe('parseServerIssues', () => {
	it('привязывает строки сервера к узлам по коду и к рёбрам по имени', () => {
		const draft = fromServer(SERVER);
		const issues = parseServerIssues(
			[
				'Воронка должна иметь ровно один статус типа initial, найдено 0',
				'Недостижимые из initial статусы: second, won',
				'Статусы без пути в терминальный статус (ловушки): second',
				'transitions[Закрыть].conditions.field: поле ‘nope’ не разрешено в условиях',
				'transitions[Дальше].actions.request_signature.on_rejected: статус ‘x’ не найден в воронке',
				'Что-то новое'
			],
			['Переход «Закрыть» в won обычно требует условие по сумме и дате закрытия'],
			draft
		);
		expect(issues.map((i) => i.code)).toEqual(['initial_count', 'unreachable', 'trap', 'condition', 'signature_on_rejected', 'server', 'won_without_conditions']);
		expect(issues[1].statusKeys).toEqual(['s2', 'won']);
		expect(issues[3].transitionKeys).toEqual(['t2']);
		expect(issues[4].transitionKeys).toEqual(['t1']);
		expect(issues[6]).toMatchObject({ severity: 'warning', transitionKeys: ['t2'], source: 'server' });
	});
});
