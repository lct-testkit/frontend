import { describe, expect, it } from 'vitest';
import {
	applyPreset,
	canApplyImport,
	canRollbackImport,
	checkMapping,
	entityInfo,
	importStep,
	missingRequirements,
	rowStatus,
	sampleValues,
	sourceFormatFromName,
	type ImportEntityType
} from './mapping';

const field = (target: string, label: string, required = false) => ({ target, label, kind: 'text', required });

// то, что отдаёт `GET /api/imports/entity-types`: организации (ключ — ИНН) и оплаты (люди: имя и способ связи)
const organization: ImportEntityType = {
	code: 'organization',
	label: 'Организации',
	source_formats: ['xlsx', 'csv', 'json'],
	fields: [field('name', 'Наименование', true), field('inn', 'ИНН', true), field('legal_address', 'Юридический адрес')],
	requirements: ['Наименование', 'ИНН']
};
const payment: ImportEntityType = {
	code: 'payment',
	label: 'Оплаты',
	source_formats: ['json'],
	fields: [
		field('order_number', 'Номер заявки', true),
		field('product_name', 'Курс', true),
		field('full_name', 'ФИО'),
		field('last_name', 'Фамилия'),
		field('first_name', 'Имя'),
		field('email', 'Email'),
		field('phone', 'Телефон')
	],
	requirements: ['Номер заявки', 'Курс', 'ФИО (или Фамилия и Имя)', 'Email или Телефон']
};

describe('checkMapping', () => {
	const headers = ['Наименование', 'ИНН', 'Город'];

	it('без обязательного поля — нельзя продолжать, названия те же, что у сервера', () => {
		const check = checkMapping({ Наименование: 'name' }, headers, organization);
		expect(check.ok).toBe(false);
		expect(check.missing).toEqual(['ИНН']);
		expect(check.unmappedHeaders).toEqual(['ИНН', 'Город']);
	});

	it('дубли полей — ошибка', () => {
		const check = checkMapping({ Наименование: 'inn', ИНН: 'inn' }, headers, organization);
		expect(check.duplicateTargets).toEqual(['inn']);
		expect(check.errors.some((e) => /нескольких колонок/.test(e))).toBe(true);
		expect(check.ok).toBe(false);
	});

	it('неизвестное серверу поле — ошибка', () => {
		const check = checkMapping({ Наименование: 'name', ИНН: 'inn', Город: 'city' }, headers, organization);
		expect(check.errors[0]).toMatch(/city/);
	});

	it('всё обязательное сопоставлено — маппинг применим', () => {
		expect(checkMapping({ Наименование: 'name', ИНН: 'inn' }, headers, organization).ok).toBe(true);
	});

	it('колонки, которых нет в файле, игнорируются', () => {
		const check = checkMapping({ ИНН: 'inn', Старая: 'name' }, headers, organization);
		expect(check.missing).toEqual(['Наименование']);
	});

	it('тип ещё не загружен — проверять нечем', () => {
		expect(checkMapping({ ИНН: 'inn' }, headers, null).ok).toBe(false);
	});
});

describe('missingRequirements (типы про людей)', () => {
	it('нужны имя и способ связи, даже если флагов required нет', () => {
		expect(missingRequirements(['order_number', 'product_name'], payment)).toEqual(['ФИО (или Фамилия и Имя)', 'Email или Телефон']);
	});

	it('фамилия и имя по отдельности заменяют ФИО', () => {
		expect(missingRequirements(['order_number', 'product_name', 'last_name', 'first_name', 'phone'], payment)).toEqual([]);
	});

	it('одной фамилии мало', () => {
		expect(missingRequirements(['order_number', 'product_name', 'last_name', 'email'], payment)).toEqual(['ФИО (или Фамилия и Имя)']);
	});

	it('у типа без полей контакта этих условий нет', () => {
		expect(missingRequirements(['name', 'inn'], organization)).toEqual([]);
	});
});

describe('подписи типов', () => {
	it('известный тип — короткая подпись и подсказка', () => {
		expect(entityInfo({ code: 'payment', label: 'Оплаты (заказы физлиц на курсы)' }).label).toBe('Оплаты');
	});

	it('неизвестный серверу-новее тип — его собственная подпись', () => {
		expect(entityInfo({ code: 'invoice', label: 'Счета' })).toEqual({ label: 'Счета', hint: '' });
	});

	it('статусы строк', () => {
		expect(rowStatus('error').tone).toBe('error');
		expect(rowStatus('rollback_blocked').label).toBe('Откат заблокирован');
		expect(rowStatus('новый').label).toBe('новый');
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
		expect(sourceFormatFromName('Данные оплат.json')).toBe('json');
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
