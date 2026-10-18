import { describe, expect, it } from 'vitest';
import type { Condition } from './dsl';
import {
	defaultLayers,
	edgeLayer,
	insertStepAfter,
	isOptionalStep,
	moveStep,
	setOptional,
	stepsOf,
	fromServer,
	layerCounts,
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
import { funnel14, stepId } from './fixtures/workflow14';
import { hasErrors, mergeIssues, parseServerIssues, transitionIssues, validateGraph } from './validation';

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
		draft.sla_rules.push({ key: 'x', status: fresh.key, max_duration_hours: 24, warn_threshold_pct: 80, escalate_threshold_pct: 150, escalate_to_role: null, escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true });

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
		draft.sla_rules.push({ key: 'r', status: 'b', max_duration_hours: 72, warn_threshold_pct: 80, escalate_threshold_pct: 150, escalate_to_role: 'HEAD', escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true });
		expect(validateGraph(draft)).toEqual([]);
	});

	it('SLA: границы и дубли активных правил', () => {
		const draft = draftOf([status('a', 'initial'), status('won', 'won')], [transition('a', 'won')]);
		const rule = { key: 'r', status: 'a', max_duration_hours: 0, warn_threshold_pct: 150, escalate_threshold_pct: 150, escalate_to_role: null, escalate_to_user_id: null, channels: [], count_business_days: true, is_active: true };
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
	const draft = fromServer(SERVER);

	it('ответ с issues даёт замечания по кодам и refs, без разбора текста', () => {
		const issues = parseServerIssues(
			{
				ok: false,
				errors: ['текст, который не должен разбираться'],
				warnings: [],
				issues: [
					{ code: 'INITIAL_COUNT', severity: 'error', message: 'нет начального', refs: [] },
					{ code: 'UNREACHABLE_STATUS', severity: 'error', message: 'недостижимые', refs: ['second', 'won'] },
					{ code: 'TRAP_STATUS', severity: 'error', message: 'ловушки', refs: ['second'] },
					{ code: 'CONDITION_INVALID', severity: 'error', message: 'условие', path: 'transitions[Закрыть].conditions' },
					{ code: 'SIGNATURE_REJECT_TARGET_UNKNOWN', severity: 'error', message: 'откат', path: 'transitions[Дальше].actions', refs: ['x'] },
					{ code: 'WON_WITHOUT_AMOUNT_OR_DATE', severity: 'warning', message: 'совет', path: 'transitions[Закрыть]' },
					{ code: 'PARKED_WITHOUT_EXIT', severity: 'warning', message: 'заморозка', refs: ['first'] },
					{ code: 'SOMETHING_NEW', severity: 'warning', message: 'новое' }
				]
			},
			draft
		);
		expect(issues.map((i) => i.code)).toEqual(['initial_count', 'unreachable', 'trap', 'condition', 'signature_on_rejected', 'won_without_conditions', 'parked_no_exit', 'something_new']);
		expect(issues[1].statusKeys).toEqual(['s2', 'won']);
		expect(issues[2].statusKeys).toEqual(['s2']);
		expect(issues[3].transitionKeys).toEqual(['t2']);
		// refs у подписи — цель действия, а не узел с проблемой
		expect(issues[4]).toMatchObject({ statusKeys: [], transitionKeys: ['t1'] });
		expect(issues[5]).toMatchObject({ severity: 'warning', transitionKeys: ['t2'], source: 'server' });
		expect(issues[6].statusKeys).toEqual(['s1']);
		expect(issues[7]).toMatchObject({ statusKeys: [], transitionKeys: [] });
	});

	describe('одинаковые имена переходов', () => {
		const funnel = fromServer(funnel14());

		it('ошибка у одного «Отказа» подсвечивает только его, если клиентская проверка нашла тот же', () => {
			const broken = funnel.transitions.find((t) => t.name === 'Отказ' && t.from === stepId(7));
			const withBug: GraphDraft = { ...funnel, transitions: funnel.transitions.map((t) => (t === broken ? { ...t, conditions: { field: 'nope', op: 'not_null' } as Condition } : t)) };
			const client = validateGraph(withBug);
			const issues = parseServerIssues({ ok: false, issues: [{ code: 'CONDITION_INVALID', severity: 'error', message: 'x', path: 'transitions[Отказ].conditions' }] }, withBug, client);
			expect(funnel.transitions.filter((t) => t.name === 'Отказ')).toHaveLength(14);
			expect(issues[0].transitionKeys).toEqual([broken?.key]);
		});

		it('если клиентская проверка молчит — все переходы с этим именем (честно «не знаем какой»)', () => {
			const issues = parseServerIssues({ ok: false, issues: [{ code: 'CONDITION_INVALID', severity: 'error', message: 'x', path: 'transitions[Отказ].conditions' }] }, funnel, []);
			expect(issues[0].transitionKeys).toHaveLength(14);
		});

		it('переход без имени: путь «из->в» находит ровно одно ребро', () => {
			const a = funnel.statuses[0].key;
			const b = funnel.statuses[1].key;
			const issues = parseServerIssues({ ok: false, issues: [{ code: 'CONDITION_INVALID', severity: 'error', message: 'x', path: `transitions[${a}->${b}].conditions` }] }, funnel);
			expect(issues[0].transitionKeys).toEqual([funnel.transitions.find((t) => t.from === a && t.to === b)?.key]);
		});
	});

	it('коды и переходы, которых нет в черновике, не ломают разбор: замечание без привязки', () => {
		const issues = parseServerIssues(
			{
				ok: false,
				issues: [
					{ code: 'TRAP_STATUS', severity: 'error', message: 'x', refs: ['nobody'] },
					{ code: 'CONDITION_INVALID', severity: 'error', message: 'y', path: 'transitions[Нет такого].conditions' }
				]
			},
			draft
		);
		expect(issues).toHaveLength(2);
		expect(issues.every((i) => i.statusKeys.length === 0 && i.transitionKeys.length === 0)).toBe(true);
	});

	it('ответ без issues разбирается по строкам, как раньше', () => {
		const issues = parseServerIssues(
			{
				ok: false,
				errors: [
					'Воронка должна иметь ровно один статус типа initial, найдено 0',
					'Недостижимые из initial статусы: second, won',
					'Статусы без пути в терминальный статус (ловушки): second',
					'transitions[Закрыть].conditions.field: поле ‘nope’ не разрешено в условиях',
					'transitions[Дальше].actions.request_signature.on_rejected: статус ‘x’ не найден в воронке',
					'Что-то новое'
				],
				warnings: ['Переход «Закрыть» в won обычно требует условие по сумме и дате закрытия']
			},
			draft
		);
		expect(issues.map((i) => i.code)).toEqual(['initial_count', 'unreachable', 'trap', 'condition', 'signature_on_rejected', 'server', 'won_without_conditions']);
		expect(issues[1].statusKeys).toEqual(['s2', 'won']);
		expect(issues[3].transitionKeys).toEqual(['t2']);
		expect(issues[4].transitionKeys).toEqual(['t1']);
		expect(issues[6]).toMatchObject({ severity: 'warning', transitionKeys: ['t2'], source: 'server' });
	});

	it('пустой issues при непустых errors — старый бэкенд, разбор строк', () => {
		const issues = parseServerIssues({ ok: false, errors: ['Недостижимые из initial статусы: second'], issues: [] }, draft);
		expect(issues[0]).toMatchObject({ code: 'unreachable', statusKeys: ['s2'] });
	});
});

describe('клиентская проверка воронки из 14 шагов', () => {
	it('условия по файлам шага (step_attachments.*) допустимы — как на сервере', () => {
		const draft = fromServer(funnel14());
		const withCondition = (conditions: Condition): GraphDraft => ({ ...draft, transitions: draft.transitions.map((t) => (t.name === 'Далее: шаг 5' ? { ...t, conditions } : t)) });
		expect(hasErrors(validateGraph(withCondition({ op: 'exists', field: 'step_attachments.contract' } as Condition)))).toBe(false);
		expect(validateGraph(withCondition({ op: 'exists', field: 'step_attachments.nope' } as Condition)).some((i) => i.code === 'condition' && /категория/.test(i.message))).toBe(true);
	});

	it('граф из 17 статусов и 71 перехода проверяется без ошибок и быстро', () => {
		const draft = fromServer(funnel14());
		const started = performance.now();
		const issues = validateGraph(draft);
		expect(performance.now() - started).toBeLessThan(50);
		expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
	});

	it('заморозка без выходов — совет parked_no_exit, не ошибка', () => {
		const draft = fromServer(funnel14());
		const noExit: GraphDraft = { ...draft, transitions: draft.transitions.filter((t) => t.from !== 'parked') };
		expect(validateGraph(noExit).find((i) => i.code === 'parked_no_exit')).toMatchObject({ severity: 'warning', statusKeys: ['parked'] });
	});
});

describe('mergeIssues', () => {
	const mk = (code: string, statusKeys: string[], transitionKeys: string[], source: 'client' | 'server') => ({ severity: 'error' as const, code, message: code, statusKeys, transitionKeys, source });
	it('серверное замечание, которое клиент уже нашёл, не повторяется', () => {
		const merged = mergeIssues([mk('condition', [], ['t1'], 'client')], [mk('condition', [], ['t1'], 'server'), mk('condition', [], ['t2'], 'server')]);
		expect(merged.map((i) => [i.source, i.transitionKeys[0]])).toEqual([['client', 't1'], ['server', 't2']]);
	});
	it('замечание без привязки не считается повтором', () => {
		const merged = mergeIssues([mk('server', [], [], 'client')], [mk('server', [], [], 'server')]);
		expect(merged).toHaveLength(2);
	});
});

describe('слои рёбер (воронка из 14 шагов)', () => {
	const plain = fromServer(funnel14({ optionalStep5: false }));
	const optional = fromServer(funnel14());

	it('без перехода через шаг: 14, 0, 13, 28, 14 рёбер по слоям, всего 69', () => {
		expect(layerCounts(plain)).toEqual({ main: 14, skip: 0, back: 13, exit: 28, resume: 14 });
		expect(plain.transitions).toHaveLength(69);
	});

	it('с переходом 4 → 6: слой skip = 1', () => {
		const counts = layerCounts(optional);
		expect(counts.skip).toBe(1);
		expect(counts.main).toBe(14);
		expect(counts.back).toBe(14);
	});

	it('слой одного ребра: вперёд, через шаг, назад, в отказ, из заморозки, в успех', () => {
		const find = (from: string, to: string) => optional.transitions.find((t) => t.from === from && t.to === to)!;
		expect(edgeLayer(optional, find(stepId(1), stepId(2)))).toBe('main');
		expect(edgeLayer(optional, find(stepId(4), stepId(6)))).toBe('skip');
		expect(edgeLayer(optional, find(stepId(5), stepId(4)))).toBe('back');
		expect(edgeLayer(optional, find(stepId(3), 'lost'))).toBe('exit');
		expect(edgeLayer(optional, find(stepId(3), 'parked'))).toBe('exit');
		expect(edgeLayer(optional, find('parked', stepId(3)))).toBe('resume');
		expect(edgeLayer(optional, find(stepId(14), 'won'))).toBe('main');
	});

	it('toFlow с основным путём и пропусками отдаёт 14 (с шагом через — 15) рёбер; все 69 — при всех слоях', () => {
		const main = new Set(['main', 'skip'] as const);
		expect(toFlow(plain, {}, [], { layers: main }).edges).toHaveLength(14);
		expect(toFlow(optional, {}, [], { layers: main }).edges).toHaveLength(15);
		const all = toFlow(plain, {}, [], { layers: new Set(['main', 'skip', 'back', 'exit', 'resume'] as const) });
		expect(all.edges).toHaveLength(69);
		expect(all.total).toBe(69);
		expect(toFlow(plain, {}, [], { layers: main }).total).toBe(69);
	});

	it('без параметра layers рисуются все рёбра, как раньше', () => {
		expect(toFlow(plain, {}).edges).toHaveLength(69);
	});

	it('ребро скрытого слоя с ошибкой проверки остаётся', () => {
		const exit = plain.transitions.find((t) => t.name === 'Отказ' && t.from === stepId(7))!;
		const issue = { severity: 'error' as const, code: 'condition', message: 'x', statusKeys: [], transitionKeys: [exit.key], source: 'client' as const };
		const flow = toFlow(plain, {}, [issue], { layers: new Set(['main'] as const) });
		expect(flow.edges.map((e) => e.id)).toContain(exit.key);
		expect(flow.edges).toHaveLength(15);
		// предупреждение скрытый слой не возвращает
		expect(toFlow(plain, {}, [{ ...issue, severity: 'warning' }], { layers: new Set(['main'] as const) }).edges).toHaveLength(14);
	});

	it('закреплённые рёбра (переходы выбранного статуса) и несохранённые показываются при скрытом слое', () => {
		const pinned = plain.transitions.filter((t) => t.from === stepId(3) || t.to === stepId(3)).map((t) => t.key);
		const flow = toFlow(plain, {}, [], { layers: new Set(['main'] as const), pinned: new Set(pinned) });
		expect(flow.edges).toHaveLength(14 + pinned.filter((k) => edgeLayer(plain, plain.transitions.find((t) => t.key === k)!) !== 'main').length);
		const added = { ...plain, transitions: [...plain.transitions, newTransition(plain, stepId(2), stepId(9))] };
		expect(toFlow(added, {}, [], { layers: new Set(['main'] as const) }).edges).toHaveLength(15);
	});

	it('узлы: значки «Отказ» и «Заморозка», у «Отказ» и «Заморозка» — счётчик входов', () => {
		const nodes = toFlow(plain, {}).nodes;
		const step = nodes.find((n) => n.id === stepId(5))!;
		expect(step.data.exits).toEqual({ lost: true, parked: true });
		expect(nodes.find((n) => n.id === 'lost')!.data.entries).toBe(14);
		expect(nodes.find((n) => n.id === 'parked')!.data.entries).toBe(14);
		expect(nodes.find((n) => n.id === 'won')!.data.entries).toBe(0);
	});

	it('воронка из 4 статусов показывает всё; по умолчанию слои — все только до 16 переходов', () => {
		const small = draftOf([status('a', 'initial'), status('b'), status('won', 'won'), status('lost', 'lost')], [transition('a', 'b'), transition('b', 'won'), transition('b', 'lost'), transition('b', 'a')]);
		expect(toFlow(small, {}, [], { layers: defaultLayers(small.transitions.length) }).edges).toHaveLength(4);
		expect(defaultLayers(16).size).toBe(5);
		expect([...defaultLayers(17)]).toEqual(['main', 'skip']);
	});

	it('архивные статусы не ломают классификацию: шаги считаются без них, переход в архивный — main', () => {
		const withArchived: GraphDraft = {
			...plain,
			statuses: plain.statuses.map((s) => (s.key === stepId(5) ? { ...s, is_archived: true } : s))
		};
		const counts = layerCounts(withArchived);
		// шаг 5 вне цепочки: 4 → 6 теперь соседние (main), переходов в / из архивного статуса в подсчёте нет
		expect(counts.skip).toBe(0);
		const into = plain.transitions.find((t) => t.from === stepId(4) && t.to === stepId(5))!;
		expect(edgeLayer(withArchived, into)).toBe('main');
	});
});

describe('порядок шагов и необязательный шаг', () => {
	const base = () => fromServer(funnel14({ optionalStep5: false }));
	const order = (d: GraphDraft) => stepsOf(d).map((s) => s.key);
	const ids = (n: number[]) => n.map(stepId);
	const pair = (d: GraphDraft, from: string, to: string) => d.transitions.filter((t) => t.from === from && t.to === to).length;

	it('stepsOf: только не архивные начальный и промежуточные, по порядку', () => {
		const d = base();
		expect(order(d)).toEqual(ids([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]));
		const archived: GraphDraft = { ...d, statuses: d.statuses.map((s) => (s.key === stepId(3) ? { ...s, is_archived: true } : s)) };
		expect(order(archived)).not.toContain(stepId(3));
	});

	describe('moveStep', () => {
		it('шаг 7 выше — становится шестым, номера перенумерованы 10, 20, 30…', () => {
			const moved = moveStep(base(), stepId(7), -1);
			expect(order(moved).slice(4, 8)).toEqual(ids([5, 7, 6, 8]));
			expect(stepsOf(moved).map((s) => s.sort_order)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);
		});
		it('вниз', () => {
			expect(order(moveStep(base(), stepId(7), 1)).slice(5, 8)).toEqual(ids([6, 8, 7]));
		});
		it('на границах: первый не уходит выше, начальный не уходит ниже второго, никто не встаёт выше начального', () => {
			const d = base();
			expect(moveStep(d, stepId(1), -1)).toBe(d);
			expect(moveStep(d, stepId(1), 1)).toBe(d);
			expect(moveStep(d, stepId(2), -1)).toBe(d);
			expect(moveStep(d, stepId(14), 1)).toBe(d);
		});
		it('одинаковый порядок у двух шагов: сдвиг всё равно меняет их местами и даёт разные номера', () => {
			const d = base();
			const same: GraphDraft = { ...d, statuses: d.statuses.map((s) => (s.key === stepId(4) ? { ...s, sort_order: 30 } : s)) };
			expect(order(same).slice(2, 4)).toEqual(ids([3, 4]));
			const moved = moveStep(same, stepId(4), -1);
			expect(order(moved).slice(2, 4)).toEqual(ids([4, 3]));
			expect(new Set(stepsOf(moved).map((s) => s.sort_order)).size).toBe(14);
		});
		it('завершающие статусы не трогаются', () => {
			const moved = moveStep(base(), stepId(7), -1);
			expect(moved.statuses.filter((s) => s.type === 'won' || s.type === 'lost' || s.type === 'parked').map((s) => s.sort_order)).toEqual([1000, 1010, 1020]);
		});
	});

	describe('insertStepAfter', () => {
		it('обязательный шаг после шага 6: два новых перехода (вперёд и назад) с каждой стороны, прямой 6 → 7 заменён путём через новый', () => {
			const { draft, key } = insertStepAfter(base(), stepId(6), { name: 'Согласование' });
			expect(order(draft).slice(5, 8)).toEqual([stepId(6), key, stepId(7)]);
			expect(pair(draft, stepId(6), key)).toBe(1);
			expect(pair(draft, key, stepId(6))).toBe(1);
			expect(pair(draft, key, stepId(7))).toBe(1);
			expect(pair(draft, stepId(7), key)).toBe(1);
			expect(pair(draft, stepId(6), stepId(7))).toBe(0);
			expect(draft.transitions).toHaveLength(base().transitions.length - 1 + 4);
			expect(draft.statuses.find((s) => s.key === key)).toMatchObject({ type: 'intermediate', id: null });
		});
		it('необязательный шаг: прямой переход 6 → 7 остаётся', () => {
			const { draft, key } = insertStepAfter(base(), stepId(6), { required: false });
			expect(pair(draft, stepId(6), stepId(7))).toBe(1);
			expect(isOptionalStep(draft, key)).toBe(true);
		});
		it('после последнего шага — только пара «после ↔ новый»', () => {
			const { draft, key } = insertStepAfter(base(), stepId(14));
			expect(order(draft).at(-1)).toBe(key);
			expect(draft.transitions).toHaveLength(base().transitions.length + 2);
		});
		it('неизвестный ключ — ничего не меняется', () => {
			const d = base();
			expect(insertStepAfter(d, 'nope')).toEqual({ draft: d, key: '' });
		});
	});

	describe('setOptional', () => {
		it('включение создаёт ровно один переход 4 → 6, повторное не дублирует, выключение удаляет', () => {
			const d = base();
			const on = setOptional(d, stepId(5), true);
			expect(pair(on, stepId(4), stepId(6))).toBe(1);
			expect(on.transitions.find((t) => t.from === stepId(4) && t.to === stepId(6))?.name).toMatch(/^Пропустить: /);
			expect(setOptional(on, stepId(5), true)).toBe(on);
			expect(isOptionalStep(on, stepId(5))).toBe(true);
			const off = setOptional(on, stepId(5), false);
			expect(pair(off, stepId(4), stepId(6))).toBe(0);
			expect(isOptionalStep(off, stepId(5))).toBe(false);
		});
		it('у первого и последнего шага переключать нечего', () => {
			const d = base();
			expect(setOptional(d, stepId(1), true)).toBe(d);
			expect(setOptional(d, stepId(14), true)).toBe(d);
			expect(isOptionalStep(d, stepId(1))).toBe(false);
		});
	});

	describe('newStatus', () => {
		it('при завершающих статусах 1000–1020 новый шаг получает номер до 1000, а не 1030', () => {
			const d = base();
			expect(newStatus(d).sort_order).toBe(150);
		});
		it('новый завершающий — за последним завершающим', () => {
			expect(newStatus(base(), { type: 'lost' }).sort_order).toBe(1030);
		});
		it('в пустой воронке — 10', () => {
			expect(newStatus({ statuses: [], transitions: [], sla_rules: [] }).sort_order).toBe(10);
		});
	});
});
