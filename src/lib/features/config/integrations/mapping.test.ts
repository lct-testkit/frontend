import { describe, expect, it } from 'vitest';
import { CUSTOM_TARGET, canonicalKey, draftToRule, emptyDraft, lacksContact, mapServerIssues, parseSample, parseValueMap, ruleToDraft, suggestSources, toMapping, unusedKeys, validateDrafts } from './mapping';

const draft = (patch: Partial<ReturnType<typeof emptyDraft>>) => ({ ...emptyDraft(), ...patch });

describe('canonicalKey (как на сервере)', () => {
	it('регистр, пробелы, дефисы и подчёркивания, «ё»', () => {
		expect(canonicalKey('НОМЕР  ЗАЯВКИ')).toBe('номер_заявки');
		expect(canonicalKey('номер_заявки')).toBe('номер_заявки');
		expect(canonicalKey('Номер-Заявки')).toBe('номер_заявки');
		expect(canonicalKey('Ёлка')).toBe('елка');
		expect(canonicalKey('  E-Mail ')).toBe('e_mail');
	});
});

describe('правило ⇄ черновик', () => {
	it('замена значений: пары в строках и обратно', () => {
		const rule = { target: 'course', transform: 'value_map' as const, source: 'product_interest', required: false, value_map: { 'python-basics': 'py-base', 'data-analysis': 'ds-pro' } };
		const d = ruleToDraft(rule);
		expect(d.valueMap).toBe('python-basics = py-base\ndata-analysis = ds-pro');
		expect(draftToRule(d)).toMatchObject({ target: 'course', source: 'product_interest', value_map: rule.value_map });
	});
	it('своё поле сделки: цель custom_fields.<код>', () => {
		const d = ruleToDraft({ target: 'custom_fields.utm', source: 'source_campaign', transform: 'none', required: false });
		expect(d.target).toBe(CUSTOM_TARGET);
		expect(d.custom).toBe('utm');
		expect(draftToRule(d).target).toBe('custom_fields.utm');
	});
	it('склейка берёт sources, а не source; постоянное значение — без source', () => {
		expect(draftToRule(draft({ target: 'name', transform: 'join', sources: 'Фамилия\nИмя', source: 'лишнее' }))).toEqual({ target: 'name', transform: 'join', required: false, sources: ['Фамилия', 'Имя'] });
		expect(draftToRule(draft({ target: 'comment', transform: 'constant', constant: 'сайт', source: 'x' }))).toEqual({ target: 'comment', transform: 'constant', required: false, constant: 'сайт' });
	});
	it('toMapping несёт режим и все правила по порядку', () => {
		const m = toMapping([draft({ target: 'email', source: 'mail' }), draft({ target: 'phone', source: 'tel' })], 'passthrough');
		expect(m.mode).toBe('passthrough');
		expect((m.rules ?? []).map((r) => r.target)).toEqual(['email', 'phone']);
	});
});

describe('parseValueMap', () => {
	it('пустые строки пропускаются, значение может содержать «=»', () => {
		expect(parseValueMap('a = b\n\nc=d=e')).toEqual({ map: { a: 'b', c: 'd=e' }, error: null });
	});
	it('строка без «=» — ошибка с номером', () => {
		expect(parseValueMap('a = b\nплохо').error).toMatch(/Строка 2/);
	});
});

describe('validateDrafts', () => {
	it('пустое правило: нет цели и ключа', () => {
		expect(validateDrafts([emptyDraft()])[0]).toEqual({ target: 'Выберите поле CRM', source: 'Укажите ключ в запросе' });
	});
	it('склейка, шаблон, замена, постоянное значение', () => {
		const [join, tpl, vm, cst] = validateDrafts([
			draft({ target: 'name', transform: 'join', sources: 'один' }),
			draft({ target: 'comment', transform: 'template', source: 'x', template: 'Кампания: {other}' }),
			draft({ target: 'course', transform: 'value_map', source: 'x', valueMap: '' }),
			draft({ target: 'comment', transform: 'constant' })
		]);
		expect(join.sources).toMatch(/не меньше двух/);
		expect(tpl.template).toMatch(/\{value\}/);
		expect(vm.value_map).toMatch(/хотя бы одну/);
		expect(cst.constant).toBeTruthy();
	});
	it('верное правило без замечаний; код своего поля проверяется', () => {
		expect(validateDrafts([draft({ target: 'email', source: 'mail', transform: 'lower' })])[0]).toEqual({});
		expect(validateDrafts([draft({ target: CUSTOM_TARGET, custom: '1 abc', source: 'x' })])[0].target).toMatch(/латиница/);
	});
});

describe('lacksContact', () => {
	it('нужен email или телефон', () => {
		expect(lacksContact([draft({ target: 'name' })])).toBe(true);
		expect(lacksContact([draft({ target: 'name' }), draft({ target: 'phone' })])).toBe(false);
	});
});

describe('mapServerIssues', () => {
	const drafts = [draft({ target: 'email' }), draft({ target: CUSTOM_TARGET, custom: 'utm' })];
	it('rules[i].поле — под правило; custom_fields.код — под правило со своим полем; остальное — общим списком', () => {
		const r = mapServerIssues(
			[
				{ field: 'rules[0].target', reason: 'неизвестная цель: mail' },
				{ field: 'rules[1].template', reason: 'допустима только подстановка {value}' },
				{ field: 'custom_fields.utm', reason: 'нет активного определения' },
				{ field: 'rules', reason: 'нужна цель email или phone' }
			],
			drafts
		);
		expect(r.byRule[0].target).toMatch(/неизвестная цель/);
		expect(r.byRule[1].template).toBeTruthy();
		expect(r.byRule[1].target).toBe('нет активного определения');
		expect(r.form).toEqual(['нужна цель email или phone']);
	});
});

describe('parseSample', () => {
	it('пусто, не JSON, массив, слишком большой, объект', () => {
		expect(parseSample('  ').state).toBe('empty');
		expect(parseSample('{ "a": ').state).toBe('error');
		expect(parseSample('[1]')).toMatchObject({ state: 'error', message: expect.stringMatching(/один объект/) });
		expect(parseSample(JSON.stringify({ a: 'x'.repeat(21 * 1024) }))).toMatchObject({ state: 'error', message: 'Пример больше 20 КБ' });
		expect(parseSample('{"a":1}')).toEqual({ state: 'ok', record: { a: 1 } });
	});
});

describe('подсказки по ключам образца', () => {
	it('неиспользованные ключи и подходящие цели (по коду и названию)', () => {
		const keys = ['Телефон', 'lead_id', 'Номер заявки'];
		expect(unusedKeys(keys, [draft({ source: 'ТЕЛЕФОН' }), draft({ transform: 'join', sources: 'lead-id\nx' })])).toEqual(['Номер заявки']);
		expect(suggestSources(keys, 'phone', 'Телефон')).toEqual(['Телефон']);
		expect(suggestSources(keys, 'order_number', 'Номер заявки')).toEqual(['Номер заявки']);
		expect(suggestSources(keys, null, undefined)).toEqual([]);
	});
});
