import { describe, expect, it } from 'vitest';
import { allColumns, cleanSelection, columnsAsInSpec, defaultColumns, listOrder, moveColumn, sameColumns, toggleColumn } from './columns';
import { normalizeParams, paramsFor, validateParams } from './params';

const options = [
	{ key: 'organization', value: 'Вуз', default: true },
	{ key: 'direction', value: 'Направление', default: true },
	{ key: 'product', value: 'Продукт', default: true },
	{ key: 'status', value: 'Статус', default: true },
	{ key: 'owner', value: 'Ответственный', default: true },
	{ key: 'number', value: 'Номер', default: true },
	{ key: 'region', value: 'Регион', default: false }
];

describe('колонки отчёта', () => {
	it('набор по умолчанию — в порядке каталога', () => {
		expect(defaultColumns(options)).toEqual(['organization', 'direction', 'product', 'status', 'owner', 'number']);
	});

	it('первая колонка вверх и последняя вниз ничего не меняют; остальные сдвигаются', () => {
		const sel = ['a', 'b', 'c'];
		expect(moveColumn(sel, 'a', -1)).toEqual(sel);
		expect(moveColumn(sel, 'c', 1)).toEqual(sel);
		expect(moveColumn(sel, 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(moveColumn(sel, 'zzz', 1)).toEqual(sel);
	});

	it('включённая колонка встаёт в конец, повтор и сверх max не добавляются, выключенная уходит', () => {
		expect(toggleColumn(['a', 'b'], 'c', true)).toEqual(['a', 'b', 'c']);
		expect(toggleColumn(['a', 'b'], 'a', true)).toEqual(['a', 'b']);
		expect(toggleColumn(['a', 'b'], 'c', true, 2)).toEqual(['a', 'b']);
		expect(toggleColumn(['a', 'b'], 'a', false)).toEqual(['b']);
	});

	it('«как в ТЗ»: пять ключей в порядке ТЗ, отсутствующих у шаблона нет', () => {
		const tz = ['organization', 'direction', 'product', 'status', 'owner'];
		expect(columnsAsInSpec(tz, options)).toEqual(tz);
		expect(columnsAsInSpec(tz, options.filter((o) => o.key !== 'direction'))).toEqual(['organization', 'product', 'status', 'owner']);
	});

	it('очистка выбора от неизвестных ключей и повторов; «все» с ограничением', () => {
		expect(cleanSelection(['organization', 'удалённая', 'organization', 'status'], options)).toEqual(['organization', 'status']);
		expect(allColumns(options, 3)).toEqual(['organization', 'direction', 'product']);
		expect(allColumns(options)).toHaveLength(7);
	});

	it('порядок строк списка: выбранные по порядку, затем остальные по каталогу', () => {
		expect(listOrder(['status', 'organization'], options).map((o) => o.key)).toEqual(['status', 'organization', 'direction', 'product', 'owner', 'number', 'region']);
		expect(sameColumns(['a'], ['a'])).toBe(true);
		expect(sameColumns(['a', 'b'], ['b', 'a'])).toBe(false);
	});
});

describe('колонки в параметрах отчёта', () => {
	const info = { columns: options.map((o) => ({ key: o.key, title: o.value, default: o.default })) };
	const defs = paramsFor('deal_register', { limit: 1000 }, info);

	it('поле «Колонки» есть только у шаблона с выбором колонок и каталогом с сервера', () => {
		expect(defs.some((d) => d.key === 'columns')).toBe(true);
		expect(paramsFor('deal_register').some((d) => d.key === 'columns')).toBe(false);
		expect(paramsFor('kam_summary', {}, info).some((d) => d.key === 'columns')).toBe(false);
	});

	it('набор, равный умолчанию, в тело не попадает; отличающийся — попадает в выбранном порядке', () => {
		expect(normalizeParams(defs, { columns: defaultColumns(options) })).not.toHaveProperty('columns');
		expect(normalizeParams(defs, {})).not.toHaveProperty('columns');
		expect(normalizeParams(defs, { columns: ['status', 'organization'] }).columns).toEqual(['status', 'organization']);
		expect(normalizeParams(defs, { columns: ['organization', 'direction', 'product', 'status', 'owner'] }).columns).toHaveLength(5);
		expect(normalizeParams(defs, { columns: ['удалённая', 'status'] }).columns).toEqual(['status']);
	});

	it('пустой выбор — ошибка, незаданный — нет', () => {
		expect(validateParams(defs, { columns: [] }).columns).toBe('Выберите хотя бы одну колонку');
		expect(validateParams(defs, {}).columns).toBeUndefined();
	});
});
