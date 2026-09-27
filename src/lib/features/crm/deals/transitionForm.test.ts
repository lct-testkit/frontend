import { describe, expect, it } from 'vitest';
import {
	alternativeGroups,
	buildTransitionForm,
	flattenLeaves,
	isFillableField,
	isOtherReason,
	serializeTransitionFields,
	topLevelGroups,
	treeSatisfiable,
	unmetAlternatives,
	type AvailableTransitionLike,
	type ConditionNode
} from './transitionForm';

// Условия из backend/app/modules/workflow/seed.py — демо-воронка должна собираться в форму без ручной настройки.
const WON_CONDITION: ConditionNode = {
	all: [
		{ field: 'amount', op: 'not_null' },
		{ field: 'expected_close_date', op: 'not_null' }
	]
};
const LOST_CONDITION: ConditionNode = { field: 'loss_reason_id', op: 'not_null' };
const PARK_CONDITION: ConditionNode = {
	any: [
		{ field: 'custom_fields.resume_at', op: 'not_null' },
		{ field: 'custom_fields.park_reason', op: 'not_null' }
	]
};
const LMS_CONDITION: ConditionNode = {
	any: [
		{ field: 'signature_status', op: 'eq', value: 'signed' },
		{ field: 'attachments.contract', op: 'exists' }
	]
};

const transition = (overrides: Partial<AvailableTransitionLike>): AvailableTransitionLike => ({
	id: 't1',
	name: 'Переход',
	to_status_id: 's2',
	requires_comment: false,
	role_allowed: true,
	satisfied: false,
	conditions: [],
	...overrides
});

const emptyDeal = { amount: null, expected_close_date: null, loss_reason_id: null, custom_fields: {} };

describe('flattenLeaves / treeSatisfiable / topLevelGroups', () => {
	it('разворачивает вложенные all/any как dsl.flatten_leaves', () => {
		const node: ConditionNode = { all: [{ field: 'a', op: 'not_null' }, { any: [{ field: 'b', op: 'eq', value: 1 }, { field: 'c', op: 'eq', value: 2 }] }] };
		expect(flattenLeaves(node).map((l) => l.field)).toEqual(['a', 'b', 'c']);
		expect(flattenLeaves(null)).toEqual([]);
		expect(flattenLeaves({})).toEqual([]);
	});

	it('any выполнимо, если хотя бы одна ветка закрывается', () => {
		expect(treeSatisfiable(LMS_CONDITION, (l) => l.field === 'signature_status')).toBe(true);
		expect(treeSatisfiable(LMS_CONDITION, () => false)).toBe(false);
		expect(treeSatisfiable(WON_CONDITION, (l) => l.field === 'amount')).toBe(false);
		expect(treeSatisfiable(null, () => false)).toBe(true);
	});

	it('группы верхнего уровня для подписи «все / одно из»', () => {
		expect(topLevelGroups(PARK_CONDITION)).toEqual([{ mode: 'any', fields: ['custom_fields.resume_at', 'custom_fields.park_reason'] }]);
		expect(topLevelGroups(LOST_CONDITION)).toEqual([{ mode: 'all', fields: ['loss_reason_id'] }]);
	});
});

describe('buildTransitionForm', () => {
	it('won: сумма и плановая дата становятся полями диалога, отправка разрешена', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'amount', op: 'not_null', actual: null, satisfied: false },
					{ field: 'expected_close_date', op: 'not_null', actual: null, satisfied: false }
				]
			}),
			conditionTree: WON_CONDITION,
			targetStatus: { id: 's2', name: 'Успешно закрыта', type: 'won', required_fields: ['amount', 'expected_close_date'] },
			deal: emptyDeal
		});
		expect(form.fields.map((f) => [f.key, f.input])).toEqual([
			['amount', 'money'],
			['expected_close_date', 'date']
		]);
		expect(form.fields.every((f) => f.required)).toBe(true);
		expect(form.blocked).toBe(false);
		expect(form.hints).toEqual([]);
	});

	it('lost: причина отказа — Select, комментарий обязателен', () => {
		const form = buildTransitionForm({
			transition: transition({ requires_comment: true, conditions: [{ field: 'loss_reason_id', op: 'not_null', satisfied: false }] }),
			conditionTree: LOST_CONDITION,
			targetStatus: { id: 's2', name: 'Отказ', type: 'lost', required_fields: ['loss_reason_id'] },
			deal: emptyDeal
		});
		expect(form.fields).toHaveLength(1);
		expect(form.fields[0]).toMatchObject({ key: 'loss_reason_id', input: 'select', label: 'Причина отказа' });
		expect(form.needsComment).toBe(true);
	});

	it('parked: пользовательские поля берут тип и подпись из custom-field-defs, группа any', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'custom_fields.resume_at', op: 'not_null', satisfied: false },
					{ field: 'custom_fields.park_reason', op: 'not_null', satisfied: false }
				]
			}),
			conditionTree: PARK_CONDITION,
			deal: emptyDeal,
			customFieldDefs: [
				{ code: 'resume_at', label: 'Дата возобновления', field_type: 'date' },
				{ code: 'park_reason', label: 'Причина заморозки', field_type: 'select', options: { values: ['нет бюджета', 'ждём ответа'] } }
			]
		});
		expect(form.fields.map((f) => [f.key, f.input, f.label])).toEqual([
			['custom_fields.resume_at', 'date', 'Дата возобновления'],
			['custom_fields.park_reason', 'select', 'Причина заморозки']
		]);
		expect(form.fields[1].options).toEqual([
			{ key: 'нет бюджета', value: 'нет бюджета' },
			{ key: 'ждём ответа', value: 'ждём ответа' }
		]);
		expect(form.groups).toEqual([{ mode: 'any', fields: ['custom_fields.resume_at', 'custom_fields.park_reason'] }]);
		expect(form.blocked).toBe(false);
	});

	it('parked: поля группы «одно из» не обязательны по отдельности, ошибка — только если не заполнено ни одно', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'custom_fields.resume_at', op: 'not_null', satisfied: false },
					{ field: 'custom_fields.park_reason', op: 'not_null', satisfied: false }
				]
			}),
			conditionTree: PARK_CONDITION,
			deal: emptyDeal
		});
		expect(form.fields.map((f) => [f.required, f.alternative])).toEqual([
			[false, true],
			[false, true]
		]);
		expect(form.alternatives).toEqual([['custom_fields.resume_at', 'custom_fields.park_reason']]);
		const none = new Set<string>();
		expect([...unmetAlternatives(form, {}, none)]).toEqual(['custom_fields.resume_at', 'custom_fields.park_reason']);
		expect([...unmetAlternatives(form, { 'custom_fields.park_reason': 'нет бюджета' }, none)]).toEqual([]);
		expect([...unmetAlternatives(form, {}, new Set(['custom_fields.resume_at']))]).toEqual([]);
	});

	it('all: каждое поле обязательно; any с листом, который полем не закрыть, — решает бэкенд', () => {
		expect(alternativeGroups(WON_CONDITION)).toEqual([]);
		expect(alternativeGroups(LMS_CONDITION)).toEqual([]);
		expect(alternativeGroups({ all: [{ field: 'amount', op: 'not_null' }, PARK_CONDITION] })).toEqual([['custom_fields.resume_at', 'custom_fields.park_reason']]);
	});

	it('поле из «одного из» остаётся обязательным, если его требует целевой статус', () => {
		const form = buildTransitionForm({
			transition: transition({ conditions: [{ field: 'custom_fields.resume_at', op: 'not_null', satisfied: false }, { field: 'custom_fields.park_reason', op: 'not_null', satisfied: false }] }),
			conditionTree: PARK_CONDITION,
			targetStatus: { id: 's2', name: 'Заморожена', type: 'parked', required_fields: ['custom_fields.resume_at'] },
			deal: emptyDeal
		});
		expect(form.fields.map((f) => f.required)).toEqual([true, false]);
	});

	it('без определения поля тип угадывается по имени/оператору', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'custom_fields.resume_at', op: 'not_null', satisfied: false },
					{ field: 'custom_fields.contact_verified', op: 'eq', expected: true, satisfied: false }
				]
			}),
			deal: emptyDeal
		});
		expect(form.fields[0].input).toBe('date');
		expect(form.fields[1]).toMatchObject({ input: 'text', expected: true, label: 'contact verified' });
	});

	it('подпись ИЛИ вложение: подсказки вместо полей, отправка заблокирована', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'signature_status', op: 'eq', expected: 'signed', actual: 'pending', satisfied: false },
					{ field: 'attachments.contract', op: 'exists', actual: null, satisfied: false }
				]
			}),
			conditionTree: LMS_CONDITION,
			deal: emptyDeal
		});
		expect(form.fields).toEqual([]);
		expect(form.hints.map((h) => h.kind)).toEqual(['signature', 'attachment']);
		expect(form.hints[1].text).toContain('«Договор»');
		expect(form.blocked).toBe(true);
		expect(form.blockedReason).toBe('Сначала выполните условия перехода');
	});

	it('подпись уже есть — any выполнено, форма отправляется, выполненная подсказка помечена', () => {
		const form = buildTransitionForm({
			transition: transition({
				satisfied: true,
				conditions: [
					{ field: 'signature_status', op: 'eq', expected: 'signed', actual: 'signed', satisfied: true },
					{ field: 'attachments.contract', op: 'exists', actual: null, satisfied: false }
				]
			}),
			conditionTree: LMS_CONDITION,
			deal: emptyDeal
		});
		expect(form.blocked).toBe(false);
		expect(form.hints.find((h) => h.kind === 'signature')?.satisfied).toBe(true);
	});

	it('открытые задачи и незаполняемые поля дают подсказки «edit»', () => {
		const form = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'tasks.open_count', op: 'eq', expected: 0, actual: 3, satisfied: false },
					{ field: 'organization_id', op: 'not_null', actual: null, satisfied: false }
				]
			}),
			deal: emptyDeal
		});
		expect(form.hints.map((h) => h.kind)).toEqual(['tasks', 'edit']);
		expect(form.hints[0].text).toBe('Закройте открытые задачи (3)');
		expect(form.hints[1].text).toContain('«Организация»');
		expect(form.blocked).toBe(true);
	});

	it('роль не подходит — заблокировано с причиной', () => {
		const form = buildTransitionForm({ transition: transition({ role_allowed: false }), deal: emptyDeal });
		expect(form.blocked).toBe(true);
		expect(form.hints[0]).toMatchObject({ kind: 'role', text: 'Переход недоступен для вашей роли' });
	});

	it('required_fields статуса: уже заполненные не спрашиваются, пустые — спрашиваются', () => {
		const form = buildTransitionForm({
			transition: transition({}),
			targetStatus: { id: 's2', name: 'Успешно закрыта', type: 'won', required_fields: ['amount', 'expected_close_date'] },
			deal: { amount: '100.00', expected_close_date: null }
		});
		expect(form.fields.map((f) => f.key)).toEqual(['expected_close_date']);
		expect(form.fields[0].source).toBe('required_field');
		expect(form.blocked).toBe(false);
	});
});

describe('serializeTransitionFields / isFillableField', () => {
	it('белый список полей', () => {
		expect(isFillableField('amount')).toBe(true);
		expect(isFillableField('custom_fields.x')).toBe(true);
		expect(isFillableField('custom_fields.')).toBe(false);
		expect(isFillableField('organization_id')).toBe(false);
		expect(isFillableField('priority')).toBe(false);
	});

	it('даты — YYYY-MM-DD, деньги — строка с точкой, пустое не отправляется', () => {
		const fields = buildTransitionForm({
			transition: transition({
				conditions: [
					{ field: 'amount', op: 'not_null', satisfied: false },
					{ field: 'expected_close_date', op: 'not_null', satisfied: false },
					{ field: 'students_planned', op: 'gt', expected: 0, satisfied: false }
				]
			}),
			deal: emptyDeal
		}).fields;
		const body = serializeTransitionFields(
			{ amount: '1 250 000,50', expected_close_date: new Date(Date.UTC(2026, 11, 31)), students_planned: '' },
			fields
		);
		expect(body).toEqual({ amount: '1250000.50', expected_close_date: '2026-12-31' });
	});
});

describe('isOtherReason', () => {
	it('категория other или вариант «Другая причина»', () => {
		expect(isOtherReason('Что угодно', 'other')).toBe(true);
		expect(isOtherReason('Другая причина')).toBe(true);
		expect(isOtherReason('Иная причина')).toBe(true);
		expect(isOtherReason('Прочее')).toBe(true);
		expect(isOtherReason('Дорого', 'price')).toBe(false);
		expect(isOtherReason('Другой поставщик', 'competitor')).toBe(false);
		expect(isOtherReason('Другая причина', 'price')).toBe(false);
		expect(isOtherReason('Другой поставщик')).toBe(false);
		expect(isOtherReason('Прочие условия')).toBe(false);
		expect(isOtherReason(null)).toBe(false);
	});
});
