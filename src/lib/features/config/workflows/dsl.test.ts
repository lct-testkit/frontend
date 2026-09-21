import { describe, expect, it } from 'vitest';
import { describeAction, describeCondition, fieldCatalogue, flattenLeaves, isEmptyCondition, newAction } from './dsl';
import { validateActions, validateCondition } from './dsl-validate';

// Условия из сида воронок (backend/app/modules/workflow/seed.py)
const PARK = { any: [{ field: 'custom_fields.resume_at', op: 'not_null' }, { field: 'custom_fields.park_reason', op: 'not_null' }] };
const WON = { all: [{ field: 'amount', op: 'not_null' }, { field: 'expected_close_date', op: 'not_null' }] };
const LMS = { any: [{ field: 'signature_status', op: 'eq', value: 'signed' }, { field: 'attachments.contract', op: 'exists' }] };

describe('describeCondition', () => {
	const catalogue = fieldCatalogue([
		{ code: 'resume_at', label: 'Дата возобновления', field_type: 'date' },
		{ code: 'park_reason', label: 'Причина заморозки', field_type: 'string' }
	]);

	it('пустое условие — «Без условий»', () => {
		expect(describeCondition({})).toBe('Без условий');
		expect(describeCondition(null)).toBe('Без условий');
		expect(isEmptyCondition({})).toBe(true);
	});

	it('соединяет ветки «и»/«или» и подставляет русские подписи полей', () => {
		expect(describeCondition(WON)).toBe('Сумма заполнено и Ожидаемая дата закрытия заполнено');
		expect(describeCondition(PARK, catalogue)).toBe('Дата возобновления заполнено или Причина заморозки заполнено');
	});

	it('подставляет подписи вариантов и вложений', () => {
		expect(describeCondition(LMS)).toBe('Статус подписания равно «Подписан» или Вложение «Договор» есть');
	});

	it('вложенные группы берёт в скобки, даты и списки форматирует', () => {
		const node = {
			all: [
				{ field: 'amount', op: 'gt', value: 100000 },
				{ any: [{ field: 'expected_close_date', op: 'date_before', value: '2026-12-31' }, { field: 'priority', op: 'in', value: ['high', 'critical'] }] }
			]
		};
		// Intl для ru-RU разделяет разряды неразрывным пробелом — сравниваем без него.
		const nbsp = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f)}]`, 'g');
		expect(describeCondition(node).replace(nbsp, ' ')).toBe(
			'Сумма больше 100 000 и (Ожидаемая дата закрытия раньше 31.12.2026 или Приоритет одно из «Высокий», «Критический»)'
		);
	});

	it('неизвестное пользовательское поле описывается по коду', () => {
		expect(describeCondition({ field: 'custom_fields.contract_number', op: 'not_null' })).toBe('contract_number заполнено');
	});

	it('flattenLeaves разворачивает дерево', () => {
		expect(flattenLeaves(LMS).map((l) => l.field)).toEqual(['signature_status', 'attachments.contract']);
	});
});

describe('validateCondition (зеркало dsl.py)', () => {
	it('сидовые условия корректны', () => {
		expect(validateCondition(PARK)).toEqual([]);
		expect(validateCondition(WON)).toEqual([]);
		expect(validateCondition(LMS)).toEqual([]);
		expect(validateCondition({})).toEqual([]);
	});

	it('поле вне белого списка отклоняется', () => {
		expect(validateCondition({ field: 'password_hash', op: 'eq', value: 'x' })[0]).toMatch(/нельзя использовать/);
	});

	it('пользовательское поле проверяется по справочнику, если он передан', () => {
		expect(validateCondition({ field: 'custom_fields.unknown', op: 'not_null' })).toEqual([]);
		expect(validateCondition({ field: 'custom_fields.unknown', op: 'not_null' }, { knownCustomFields: new Set(['contract_number']) })).toHaveLength(1);
	});

	it('категория вложения должна быть известной', () => {
		expect(validateCondition({ field: 'attachments.nonsense', op: 'exists' })).toHaveLength(1);
	});

	it('операторы без значения не принимают value, остальные его требуют', () => {
		expect(validateCondition({ field: 'amount', op: 'not_null', value: 1 })).toHaveLength(1);
		expect(validateCondition({ field: 'amount', op: 'gt' })).toHaveLength(1);
		expect(validateCondition({ field: 'amount', op: 'gt', value: 'много' })).toHaveLength(1);
		expect(validateCondition({ field: 'priority', op: 'in', value: 'high' })).toHaveLength(1);
		expect(validateCondition({ field: 'expected_close_date', op: 'date_after', value: 'вчера' })).toHaveLength(1);
	});

	it('неизвестный оператор, пустая группа и глубокая вложенность', () => {
		expect(validateCondition({ field: 'amount', op: 'startswith', value: 1 })[0]).toMatch(/оператор/);
		expect(validateCondition({ any: [] })).toHaveLength(1);
		let node: unknown = { field: 'amount', op: 'gt', value: 1 };
		for (let i = 0; i < 6; i++) node = { all: [node] };
		expect(validateCondition(node)[0]).toMatch(/вложенность/);
	});
});

describe('validateActions (зеркало dsl.py)', () => {
	it('сидовые действия корректны', () => {
		const actions = [
			{ type: 'request_signature', template: 'kp_approval', signers: [{ role: 'HEAD' }], order: 'sequential', deadline_days: 7, on_rejected: 'previous_status', on_expired: 'notify_initiator' },
			{ type: 'create_task', title: 'Юридическое согласование договора', assignee_role: 'HEAD', due_days: 3, priority: 'high' },
			{ type: 'integration_event', event_code: 'LEARNING_TRANSFER_REQUESTED' }
		];
		expect(validateActions(actions, { statusCodes: new Set(['kp_preparation']) })).toEqual([]);
	});

	it('подписанты обязательны, опечатка в ключе не проходит', () => {
		expect(validateActions([{ type: 'request_signature', template: 'x', signers: [] }])).toHaveLength(1);
		expect(validateActions([{ type: 'notify', event_code: 'X', channel: ['in_app'] }])[0]).toMatch(/неизвестные ключи/);
	});

	it('on_rejected должен ссылаться на статус воронки', () => {
		const action = { type: 'request_signature', template: 'x', signers: [{ role: 'HEAD' }], on_rejected: 'no_such' };
		expect(validateActions([action], { statusCodes: new Set(['a', 'b']) })[0]).toMatch(/no_such/);
		expect(validateActions([action])).toEqual([]);
	});

	it('задача без исполнителя и неизвестный тип', () => {
		expect(validateActions([{ type: 'create_task', title: 'x' }])[0]).toMatch(/исполнителя/);
		expect(validateActions([{ type: 'delete_everything' }])[0]).toMatch(/неизвестный тип/);
	});

	it('заготовки newAction проходят валидацию (кроме пустого шаблона подписи)', () => {
		expect(validateActions([newAction('create_task')])).toEqual([`Действие 1: укажите заголовок задачи`]);
		expect(validateActions([newAction('notify')])).toEqual([]);
		expect(validateActions([newAction('integration_event')])).toEqual([]);
		expect(validateActions([newAction('request_signature')])).toEqual([`Действие 1: выберите шаблон документа`]);
	});
});

describe('describeAction', () => {
	it('описывает действия одной строкой', () => {
		expect(describeAction({ type: 'create_task', title: 'Согласование', assignee_role: 'HEAD', due_days: 3, priority: 'high' })).toBe(
			'Задача «Согласование» — Руководитель, срок 3 дн., приоритет: Высокий'
		);
		expect(describeAction({ type: 'integration_event', event_code: 'LEARNING_ENROLLMENT_SENT' })).toBe('Интеграция: Зачислить в LMS');
		expect(
			describeAction(
				{ type: 'request_signature', template: 'kp_approval', signers: [{ role: 'HEAD' }], order: 'sequential', deadline_days: 7, on_rejected: 'kp_preparation' },
				{ statusNames: { kp_preparation: 'Формирование КП' }, templateNames: { kp_approval: 'Согласование КП' } }
			)
		).toBe('Подпись «Согласование КП» — Руководитель, по очереди, срок 7 дн., при отклонении — в «Формирование КП»');
		expect(describeAction({ type: 'notify', event_code: 'DEAL_EVENT', recipients: ['owner'], channels: ['in_app'] })).toBe('Уведомление «DEAL_EVENT», кому: Ответственный, каналы: В системе');
		expect(describeAction('junk')).toBe('Некорректное действие');
	});
});
