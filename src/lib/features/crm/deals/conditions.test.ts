import { describe, expect, it } from 'vitest';
import type { CustomFieldDef } from '../types';
import { currentText, describeCondition, fieldLabel, formatValue } from './conditions';

const defs = [{ code: 'resume_at', label: 'Дата возобновления' }] as unknown as CustomFieldDef[];

describe('fieldLabel', () => {
	it('пользовательские поля — по определениям, вложения — по категории', () => {
		expect(fieldLabel('custom_fields.resume_at', defs)).toBe('Дата возобновления');
		expect(fieldLabel('custom_fields.some_code')).toBe('some code');
		expect(fieldLabel('attachments.contract')).toBe('Файл «Договор»');
		expect(fieldLabel('amount')).toBe('Сумма');
	});
});

describe('describeCondition', () => {
	it('подпись и заполненность', () => {
		expect(describeCondition({ field: 'signature_status', op: 'eq', expected: 'signed' })).toBe('Документ подписан');
		expect(describeCondition({ field: 'loss_reason_id', op: 'not_null' })).toBe('Причина отказа: заполнено');
		expect(describeCondition({ field: 'attachments.contract', op: 'exists' })).toBe('Прикреплён файл «Договор»');
		expect(describeCondition({ field: 'custom_fields.contact_verified', op: 'eq', expected: true })).toBe('contact verified: да');
	});
	it('сравнения', () => {
		expect(describeCondition({ field: 'tasks.open_count', op: 'eq', expected: 0 })).toBe('Открытые задачи: 0');
		expect(describeCondition({ field: 'students_planned', op: 'gte', expected: 10 })).toBe('Обучающихся (план): не меньше 10');
	});
});

describe('formatValue / currentText', () => {
	it('форматы значений', () => {
		expect(formatValue('x', null)).toBe('не указано');
		expect(formatValue('x', false)).toBe('нет');
		expect(formatValue('signature_status', 'pending')).toBe('На подписи');
		expect(formatValue('expected_close_date', '2026-03-05')).toBe('05.03.2026');
	});
	it('«сейчас» — только для невыполненных условий со значением', () => {
		expect(currentText({ field: 'signature_status', op: 'eq', actual: 'pending', satisfied: false })).toBe('сейчас: На подписи');
		expect(currentText({ field: 'signature_status', op: 'eq', actual: 'signed', satisfied: true })).toBe('');
		expect(currentText({ field: 'amount', op: 'not_null', satisfied: false })).toBe('');
	});
});
