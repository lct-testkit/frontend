import { describe, expect, it } from 'vitest';
import { LICENSE_EXAMPLE, buildTemplateCsv } from './licenseImport';

const FIELDS = [
	['organization_name', 'Название ВУЗа'],
	['vendor', 'Вендор'],
	['product_name', 'ПО'],
	['contract_number', 'Номер договора'],
	['license_signed_at', 'Подписание лицензии'],
	['license_valid_year', 'Срок действия лицензии (год)'],
	['transfer_status', 'Статус по передаче'],
	['manager_full_name', 'ФИО Менеджера'],
	['responsible_contacts', 'Ответственные от ВУЗа'],
	['comment', 'Комментарий']
].map(([target, label]) => ({ target, label, kind: 'text', required: false }));

describe('buildTemplateCsv', () => {
	const csv = buildTemplateCsv({ fields: FIELDS }, LICENSE_EXAMPLE);
	const [head, example] = csv.replace('\uFEFF', '').split('\r\n');

	it('начинается с BOM, разделитель — точка с запятой', () => {
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(head.split(';')).toHaveLength(10);
	});

	it('десять заголовков в порядке полей типа', () => {
		expect(head.split(';')).toEqual(FIELDS.map((f) => f.label));
	});

	it('вторая строка — пример по полям', () => {
		expect(example.split(';')).toHaveLength(10);
		expect(example).toContain('ЛД-2026/001');
	});

	it('значения с «;», кавычкой или переводом строки берутся в кавычки', () => {
		const out = buildTemplateCsv({ fields: [{ target: 'a', label: 'А', kind: 'text', required: false }] }, { a: 'один; "два"' });
		expect(out).toContain('"один; ""два"""');
	});

	it('без примера — только строка заголовков', () => {
		expect(buildTemplateCsv({ fields: FIELDS }).trimEnd().split('\r\n')).toHaveLength(1);
	});
});
