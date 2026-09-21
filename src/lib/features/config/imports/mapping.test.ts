import { describe, expect, it } from 'vitest';
import {
	ORGANIZATION_FIELDS,
	PRODUCT_FIELDS,
	applyPreset,
	canApplyImport,
	canRollbackImport,
	checkMapping,
	importStep,
	levenshtein,
	sampleValues,
	sourceFormatFromName,
	suggestMapping
} from './mapping';

describe('suggestMapping (зеркало imports/mapping.py)', () => {
	it('точные синонимы', () => {
		const mapping = suggestMapping(['ИНН', 'Наименование'], ORGANIZATION_FIELDS);
		expect(mapping).toEqual({ ИНН: 'inn', Наименование: 'name' });
	});

	it('нечёткое совпадение с опечаткой', () => {
		expect(suggestMapping(['Наимнование'], ORGANIZATION_FIELDS)).toEqual({ Наимнование: 'name' });
	});

	it('постороннюю колонку не сопоставляет', () => {
		expect(suggestMapping(['Совершенно постороннее поле xyz'], ORGANIZATION_FIELDS)).toEqual({});
	});

	it('два заголовка не попадают в одно поле', () => {
		const mapping = suggestMapping(['Наименование', 'название'], ORGANIZATION_FIELDS);
		expect(new Set(Object.values(mapping)).size).toBe(Object.values(mapping).length);
	});

	it('поля продукта', () => {
		expect(suggestMapping(['Код', 'Наименование', 'Цена', 'Формат'], PRODUCT_FIELDS)).toEqual({ Код: 'code', Наименование: 'name', Цена: 'base_price', Формат: 'format' });
	});

	it('синоним чужой сущности не применяется', () => {
		expect(suggestMapping(['ИНН'], PRODUCT_FIELDS)).toEqual({});
	});

	it('levenshtein', () => {
		expect(levenshtein('test', 'test')).toBe(0);
		expect(levenshtein('test', 'tent')).toBe(1);
		expect(levenshtein('', 'abc')).toBe(3);
	});
});

describe('checkMapping', () => {
	const headers = ['Наименование', 'ИНН', 'Город'];

	it('без ключевого поля — ошибка', () => {
		const check = checkMapping({ Наименование: 'name' }, headers, 'organization');
		expect(check.ok).toBe(false);
		expect(check.errors[0]).toMatch(/ИНН/);
		expect(check.unmappedHeaders).toEqual(['ИНН', 'Город']);
	});

	it('дубли полей — ошибка, необязательные пропуски — нет', () => {
		const check = checkMapping({ Наименование: 'inn', ИНН: 'inn' }, headers, 'organization');
		expect(check.duplicateTargets).toEqual(['inn']);
		expect(check.errors.some((e) => /нескольких колонок/.test(e))).toBe(true);
	});

	it('пропущенное обязательное поле — предупреждение, но маппинг применим', () => {
		const check = checkMapping({ ИНН: 'inn' }, headers, 'organization');
		expect(check.ok).toBe(true);
		expect(check.missingRequired).toEqual(['name']);
		expect(check.warnings).toHaveLength(1);
	});

	it('колонки, которых нет в файле, игнорируются', () => {
		const check = checkMapping({ ИНН: 'inn', Старая: 'name' }, headers, 'organization');
		expect(check.ok).toBe(true);
		expect(check.missingRequired).toEqual(['name']);
	});
});

describe('applyPreset / sampleValues / форматы', () => {
	it('пресет накладывается только на существующие колонки и не дублирует поля', () => {
		const merged = applyPreset({ Город: 'legal_address' }, { ИНН: 'inn', Адрес: 'legal_address', Нет: 'name' }, ['ИНН', 'Адрес', 'Город']);
		expect(merged).toEqual({ ИНН: 'inn', Адрес: 'legal_address' });
	});

	it('sampleValues — различные непустые значения', () => {
		const rows = [
			['МГУ', '7707049388'],
			['', ''],
			['МГУ', '7736207543'],
			['СПбГУ', '7801002274'],
			['КФУ', '1']
		];
		expect(sampleValues(rows, 0)).toEqual(['МГУ', 'СПбГУ', 'КФУ']);
		expect(sampleValues(rows, 1, 2)).toEqual(['7707049388', '7736207543']);
	});

	it('формат по расширению', () => {
		expect(sourceFormatFromName('Реестр вузов.XLSX')).toBe('xlsx');
		expect(sourceFormatFromName('old.xls')).toBe('xls');
		expect(sourceFormatFromName('data.csv')).toBe('csv');
		expect(sourceFormatFromName('archive.zip')).toBeNull();
	});

	it('шаги и допустимые действия по статусу задания', () => {
		expect(importStep('uploaded')).toBe(1);
		expect(importStep('validated')).toBe(2);
		expect(importStep('completed')).toBe(4);
		expect(importStep('unknown')).toBe(0);
		expect(canApplyImport({ status: 'validated', ok_rows: 0, warn_rows: 0 })).toBe(false);
		expect(canApplyImport({ status: 'validated', ok_rows: 1, warn_rows: 0 })).toBe(true);
		expect(canRollbackImport({ status: 'completed_with_errors', rollback_available: true })).toBe(true);
		expect(canRollbackImport({ status: 'rolled_back', rollback_available: false })).toBe(false);
	});
});
