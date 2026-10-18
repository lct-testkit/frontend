import { describe, expect, it } from 'vitest';
import { IMPORT_JOB_STATUS_HINTS, IMPORT_ROW_STATUS_HINTS, fieldFormatHint, importJobHint, importRowHint } from './hints';
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
