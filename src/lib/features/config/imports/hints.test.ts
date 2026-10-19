import { describe, expect, it } from 'vitest';
import { IMPORT_JOB_STATUS_HINTS, IMPORT_ROW_STATUS_HINTS, fieldFormatHint, fieldLabel, importJobHint, importRowHint } from './hints';
import { IMPORT_JOB_STATUS_INFO, IMPORT_ROW_STATUS_INFO } from './mapping';

describe('import hints', () => {
	it('every job status and every row status is explained', () => {
		expect(Object.keys(IMPORT_JOB_STATUS_HINTS).sort()).toEqual(Object.keys(IMPORT_JOB_STATUS_INFO).sort());
		expect(Object.keys(IMPORT_ROW_STATUS_HINTS).sort()).toEqual(Object.keys(IMPORT_ROW_STATUS_INFO).sort());
		for (const text of [...Object.values(IMPORT_JOB_STATUS_HINTS), ...Object.values(IMPORT_ROW_STATUS_HINTS)]) expect(text.length).toBeGreaterThan(10);
	});
	it('unknown values have no hint', () => {
		expect(importJobHint('нет')).toBeUndefined();
		expect(importRowHint('нет')).toBeUndefined();
		expect(importJobHint('failed')).toContain('ошибки');
	});
});

describe('fieldFormatHint', () => {
	it('у каждого вида полей лицензий есть подсказка формата', () => {
		for (const kind of ['organization_name', 'text', 'license_signed', 'license_term', 'transfer_status']) expect(fieldFormatHint(kind).length).toBeGreaterThan(3);
		expect(fieldFormatHint('license_term')).toContain('бессрочно');
		expect(fieldFormatHint('transfer_status')).toContain('в работе');
	});
	it('неизвестный вид — «текст»', () => {
		expect(fieldFormatHint('что-то новое')).toBe('текст');
	});
});

describe('fieldFormatHint по полю (M-2, M-4)', () => {
	it('у длительности — «например 72», у студентов остаётся пример года', () => {
		expect(fieldFormatHint('int', 'duration_hours')).toBe('целое число часов, например 72');
		expect(fieldFormatHint('int', 'students_count')).toBe('целое число, например 2027');
		expect(fieldFormatHint('int')).toBe('целое число, например 2027');
	});
	it('у учащихся LMS — форматы, а не «значение из шаблона»', () => {
		expect(fieldFormatHint('learner', 'snils')).toMatch(/^11 цифр/);
		expect(fieldFormatHint('learner', 'passport_series')).toBe('4 цифры');
		expect(fieldFormatHint('learner', 'passport_number')).toBe('6 цифр');
		expect(fieldFormatHint('learner', 'birth_date')).toBe('ДД.ММ.ГГГГ');
		expect(fieldFormatHint('learner', 'sex')).toBe('М или Ж');
		expect(fieldFormatHint('learner', 'passport_dept_code')).toContain('ХХХ-ХХХ');
	});
	it('неизвестное поле учащегося — прежняя подсказка', () => {
		expect(fieldFormatHint('learner', 'что-то')).toBe('значение из шаблона LMS');
	});
});

describe('fieldLabel', () => {
	it('возвращает скобку, потерянную в заголовке шаблона', () => {
		expect(fieldLabel('Отчествопри наличии)')).toBe('Отчество (при наличии)');
		expect(fieldLabel('Имядательный падеж)')).toBe('Имя (дательный падеж)');
	});
	it('обычные заголовки не трогает', () => {
		expect(fieldLabel('Фамилия')).toBe('Фамилия');
		expect(fieldLabel('Отчество (при наличии)')).toBe('Отчество (при наличии)');
	});
});
