import { describe, expect, it } from 'vitest';
import type { Condition } from './dsl';
import { describeRule, toRequest, validateRules, type MappingRule } from './mappingRules';

const signed = { op: 'eq', field: 'signature_status', value: 'signed' } as Condition;
const statuses = [
	{ id: 's6', name: 'Подписание документов', is_archived: false },
	{ id: 's7', name: 'Передача материалов', is_archived: false },
	{ id: 'old', name: 'Старый', is_archived: true }
];
const ctx = { archiving: 's6', statuses };

describe('toRequest', () => {
	it('без правил — пустой объект', () => expect(toRequest([])).toEqual({}));
	it('правила уходят как rules[{when, to_status_id}]', () => {
		expect(toRequest([{ when: signed, to: 's7' }])).toEqual({ rules: [{ when: signed, to_status_id: 's7' }] });
	});
});

describe('validateRules', () => {
	const check = (rule: MappingRule) => validateRules([rule], ctx)[0];
	it('корректное правило — без ошибок', () => expect(check({ when: signed, to: 's7' })).toEqual([]));
	it('цель — архивируемый статус или статус в архиве — ошибка', () => {
		expect(check({ when: signed, to: 's6' })[0]).toMatch(/архивируемый/);
		expect(check({ when: signed, to: 'old' })[0]).toMatch(/в архиве/);
	});
	it('нет цели и пустое условие — ошибки', () => {
		expect(check({ when: {}, to: '' })).toEqual(['Выберите статус, куда перенести', 'Укажите условие']);
	});
	it('условие с чужим полем не проходит проверку', () => {
		expect(check({ when: { op: 'not_null', field: 'nope' } as Condition, to: 's7' }).length).toBe(1);
	});
	it('ошибки — по строкам', () => {
		expect(validateRules([{ when: signed, to: 's7' }, { when: {}, to: 's7' }], ctx).map((e) => e.length)).toEqual([0, 1]);
	});
});

describe('describeRule', () => {
	it('фраза на русском с названием статуса', () => {
		const text = describeRule({ when: signed, to: 's7' }, (id) => statuses.find((s) => s.id === id)?.name ?? id);
		expect(text).toMatch(/^Если .+ → «Передача материалов»$/);
	});
});
