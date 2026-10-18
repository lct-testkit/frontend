import { describe, expect, it } from 'vitest';
import { softwareOf, softwareOptions, vendorOptions } from './licenseCatalog';

const p = (id: string, name: string, vendor: [string, string] | null, kind = 'software') => ({ id, name, kind, vendor_id: vendor?.[0] ?? null, vendor_name: vendor?.[1] ?? null });
const products = [p('3', 'Альт Образование', ['b', 'Базальт']), p('1', 'Astra Linux', ['a', 'Астра']), p('2', 'Astra Linux Common Edition', ['a', 'Астра']), p('4', 'Курс по Python', ['a', 'Астра'], 'course'), p('5', 'Без вендора', null)];

describe('softwareOptions', () => {
	it('оставляет только ПО и сортирует по названию', () => {
		expect(softwareOptions(products as never).map((s) => s.id)).toEqual(['3', '5', '1', '2']);
	});
});

describe('vendorOptions', () => {
	it('вендоры без повторов по алфавиту; ПО без вендора вендора не добавляет', () => {
		expect(vendorOptions(softwareOptions(products as never))).toEqual([
			{ id: 'a', name: 'Астра' },
			{ id: 'b', name: 'Базальт' }
		]);
	});
});

describe('softwareOf', () => {
	const software = softwareOptions(products as never);
	it('с вендором — только его ПО', () => {
		expect(softwareOf(software, 'a').map((s) => s.id)).toEqual(['1', '2']);
	});
	it('без вендора — всё ПО', () => {
		expect(softwareOf(software, null)).toHaveLength(4);
	});
});
