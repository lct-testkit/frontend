import { describe, expect, it } from 'vitest';
import { REPORT_SPECS, canDownloadJson, canDownloadReport, fileState, defaultFormat, describeTemplate, formatHint, formatLabel, formatsFor, hasSpec, isReportExpired, normalizeParams, normalizePosition, paramsFor, toList, validateParams } from './params';
import { runKey } from './widgets';

/** Виды отчётов бэкенда (backend/app/modules/reporting/seed.py): у каждого обязана быть форма параметров. */
const SEED_TEMPLATE_CODES = [
	'deal_funnel',
	'kam_summary',
	'region_summary',
	'loss_reasons',
	'sla_compliance',
	'monthly_dynamics',
	'stuck_deals',
	'deal_register',
	'learning_progress',
	'lms_users_upload',
	'product_demand',
	'license_register',
	'signing_periods'
];
const keysOf = (code: string) => paramsFor(code).map((d) => d.key);
const SCOPE_KEYS = ['date_from', 'date_to', 'organization_ids', 'direction_ids', 'product_ids', 'owner_ids'];

describe('реестр шаблонов', () => {
	it('у каждого вида отчёта бэкенда есть описание; лишних описаний нет', () => {
		for (const code of SEED_TEMPLATE_CODES) expect(hasSpec(code), code).toBe(true);
		expect(Object.keys(REPORT_SPECS).sort()).toEqual([...SEED_TEMPLATE_CODES].sort());
	});

	it('десять видов с общим блоком из пяти граней', () => {
		const withScope = SEED_TEMPLATE_CODES.filter((c) => !['lms_users_upload', 'license_register', 'signing_periods'].includes(c));
		for (const code of withScope) expect(keysOf(code), code).toEqual(expect.arrayContaining(SCOPE_KEYS));
	});

	it('ключи форм совпадают с тем, что читает бэкенд', () => {
		expect(keysOf('deal_funnel')).toEqual(['deal_type', 'workflow_id', 'date_field', ...SCOPE_KEYS]);
		expect(keysOf('loss_reasons')).toEqual(SCOPE_KEYS); // дата одна — выбора нет
		expect(keysOf('monthly_dynamics')).toEqual(['months', ...SCOPE_KEYS]); // date_field сервер запрещает
		expect(keysOf('stuck_deals')).toEqual(['date_field', ...SCOPE_KEYS, 'limit']);
		expect(keysOf('product_demand')).toEqual(['level', 'sort_by', 'top', 'date_field', ...SCOPE_KEYS]);
		expect(keysOf('license_register')).toEqual(['date_field', 'date_from', 'date_to', 'organization_ids', 'vendors', 'transfer_statuses', 'valid_year', 'expired', 'limit']);
		expect(keysOf('lms_users_upload')).toEqual(['product_id', 'stream_number', 'date_from', 'date_to']);
		// «Подписание по периодам»: месяцы или период, тип документа; ни вуза, ни направления, ни date_field (сервер их не принимает)
		expect(keysOf('signing_periods')).toEqual(['months', 'doc_type', 'date_from', 'date_to']);
		expect(paramsFor('нет такого')).toEqual([]);
	});

	it('даты периода берутся с сервера, иначе из описания', () => {
		const label = (code: string, info?: Parameters<typeof paramsFor>[2]) => paramsFor(code, {}, info).find((d) => d.key === 'date_from')?.label;
		expect(label('loss_reasons')).toBe('Сделка закрыта с');
		expect(label('deal_register')).toBe('Период с');
		const field = paramsFor('deal_register', {}, { dateFields: ['created_at', 'closed_at'], defaultDateField: 'closed_at' }).find((d) => d.key === 'date_field');
		expect(field?.options?.map((o) => o.key)).toEqual(['created_at', 'closed_at']);
		expect(field?.default).toBe('closed_at');
	});
});

describe('Подписание по периодам', () => {
	const defs = paramsFor('signing_periods', { months: 12 });
	it('число месяцев и период взаимоисключают друг друга; тип документа необязателен', () => {
		expect(normalizeParams(defs, {})).toEqual({ months: 12 });
		expect(normalizeParams(defs, { date_from: '2026-01-01' })).toEqual({ date_from: '2026-01-01' });
		expect(normalizeParams(defs, { doc_type: 'act', months: 6 })).toEqual({ months: 6, doc_type: 'act' });
		expect(defs.find((d) => d.key === 'doc_type')?.required).toBeFalsy();
	});
	it('месяцев от 1 до 36', () => {
		expect(validateParams(defs, { months: 0 }).months).toBeTruthy();
		expect(validateParams(defs, { months: 37 }).months).toBeTruthy();
		expect(validateParams(defs, { months: 36 })).toEqual({});
	});
	it('типы документа — коды сервера, у каждого русская подпись', () => {
		const options = defs.find((d) => d.key === 'doc_type')?.options ?? [];
		expect(options.map((o) => o.key).sort()).toEqual(['act', 'consent', 'custom', 'erasure_act', 'kp', 'offer']);
		for (const o of options) expect(o.value).toMatch(/[А-Яа-я]/);
	});
});

describe('параметры отчётов', () => {
	it('paramsFor подставляет default_params шаблона', () => {
		const defs = paramsFor('monthly_dynamics', { months: 6 });
		expect(defs[0]).toMatchObject({ key: 'months', default: 6, min: 1, max: 36 });
	});

	it('normalizeParams зажимает числа в границы и убирает пустое', () => {
		const defs = paramsFor('stuck_deals');
		expect(normalizeParams(defs, { limit: '99999' })).toEqual({ limit: 5000 });
		expect(normalizeParams(defs, { limit: -5 })).toEqual({ limit: 1 });
		expect(normalizeParams(defs, {})).toEqual({ limit: 500 });
		expect(normalizeParams(paramsFor('deal_funnel'), { deal_type: 'b2c', workflow_id: '' })).toEqual({ deal_type: 'b2c' });
	});

	it('validateParams', () => {
		const defs = paramsFor('monthly_dynamics');
		expect(validateParams(defs, { months: 'много' })).toEqual({ months: 'Введите целое число' });
		expect(validateParams(defs, { months: 40 })).toEqual({ months: 'От 1 до 36' });
		expect(validateParams(defs, {})).toEqual({});
		expect(validateParams(paramsFor('deal_funnel'), { deal_type: '' })).toEqual({});
	});

	it('списки: повторы и пустые убираются, строка из старого виджета разбирается по запятой', () => {
		const defs = paramsFor('deal_register');
		expect(normalizeParams(defs, { organization_ids: ['a', 'a', 'b'], direction_ids: [] })).toEqual({ organization_ids: ['a', 'b'], limit: 1000 });
		expect(normalizeParams(defs, { organization_ids: 'a, b' }).organization_ids).toEqual(['a', 'b']);
		expect(normalizeParams(defs, { date_from: '' })).toEqual({ limit: 1000 });
		expect(toList('x,,y, x')).toEqual(['x', 'y']);
	});

	it('дата периода по умолчанию в тело не идёт, другая — идёт', () => {
		const defs = paramsFor('deal_register');
		expect(normalizeParams(defs, { date_field: 'created_at' })).not.toHaveProperty('date_field');
		expect(normalizeParams(defs, { date_field: 'closed_at' })).toMatchObject({ date_field: 'closed_at' });
	});

	it('«Месяцев» при заданном периоде блокируется: не валидируется и не уходит в тело', () => {
		const defs = paramsFor('monthly_dynamics');
		expect(normalizeParams(defs, { months: 6, date_from: '2026-01-01' })).toEqual({ date_from: '2026-01-01' });
		expect(validateParams(defs, { months: 40, date_from: '2026-01-01' })).toEqual({});
		expect(normalizeParams(defs, { months: 6 })).toEqual({ months: 6 });
	});

	it('дата «по» раньше «с» — ошибка на «по»', () => {
		const defs = paramsFor('deal_register');
		expect(validateParams(defs, { date_from: '2026-09-30', date_to: '2026-09-01' })).toEqual({ date_to: 'Дата «по» раньше даты «с»' });
		expect(validateParams(defs, { date_from: '2026-09-01', date_to: '2026-09-01' })).toEqual({});
	});

	it('воронка другого типа — ошибка, подходящая — нет', () => {
		const defs = paramsFor('deal_funnel');
		const ctx = { workflowTypes: { w1: 'b2c', w2: 'b2b' } };
		expect(validateParams(defs, { deal_type: 'b2b', workflow_id: 'w1' }, ctx)).toEqual({ workflow_id: 'Воронка относится к другому типу сделки' });
		expect(validateParams(defs, { deal_type: 'b2b', workflow_id: 'w2' }, ctx)).toEqual({});
		expect(validateParams(defs, { workflow_id: 'w1' }, ctx).workflow_id).toBeTruthy(); // тип по умолчанию b2b
	});

	it('новые виды полей: «Показать первые», год окончания, флаг, статусы, вендоры', () => {
		expect(validateParams(paramsFor('product_demand'), { top: 0 }).top).toBe('От 1 до 100');
		const lic = paramsFor('license_register');
		expect(validateParams(lic, { valid_year: 1999 }).valid_year).toBe('От 2000 до 2100');
		expect(normalizeParams(lic, { expired: false, transfer_statuses: ['', 'in_progress'], vendors: '1С, Контур' })).toEqual({ vendors: ['1С', 'Контур'], transfer_statuses: ['in_progress'], limit: 1000 });
		expect(normalizeParams(lic, { expired: true })).toMatchObject({ expired: true });
	});

	it('runKey: порядок id не меняет ключ, строка «a,b» из старого виджета равна массиву', () => {
		expect(runKey({ template_code: 'x', params: { organization_ids: ['b', 'a'] } })).toBe(runKey({ template_code: 'x', params: { organization_ids: ['a', 'b'] } }));
		expect(runKey({ template_code: 'x', params: { organization_ids: 'b,a' } })).toBe(runKey({ template_code: 'x', params: { organization_ids: ['a', 'b'] } }));
		expect(runKey({ template_code: 'x', params: { months: 3 } })).not.toBe(runKey({ template_code: 'x', params: { months: 4 } }));
	});
});

describe('форматы отчёта', () => {
	it('формат по каноническому порядку, неизвестный не теряется', () => {
		expect(formatsFor(['pdf', 'xls', 'xlsx'])).toEqual(['xlsx', 'xls', 'pdf']);
		expect(formatsFor(['xlsx', 'ods'])).toEqual(['xlsx', 'ods']);
		expect(formatsFor(['json', 'png', 'xlsx', 'xls', 'pdf'])).toEqual(['xlsx', 'xls', 'pdf', 'png', 'json']);
		expect(formatsFor([])).toEqual([]);
	});

	it('формат по умолчанию: запомненный из доступных, иначе xlsx, иначе первый', () => {
		expect(defaultFormat(['xls', 'pdf'])).toBe('xls');
		expect(defaultFormat(['xls', 'pdf'], 'pdf')).toBe('pdf');
		expect(defaultFormat(['xlsx', 'pdf'], 'png')).toBe('xlsx');
		expect(defaultFormat(['xlsx', 'xls'])).toBe('xlsx');
		expect(defaultFormat([], 'pdf')).toBe('xlsx');
	});

	it('подписи и подсказки; неизвестный код — в верхнем регистре', () => {
		expect(formatLabel('xls')).toBe('Excel .xls');
		expect(formatLabel('xlsx')).toBe('Excel .xlsx');
		expect(formatLabel('ods')).toBe('ODS');
		expect(formatHint('xls')).toMatch(/97/);
		expect(formatHint('ods')).toBeUndefined();
	});
});

describe('описание шаблона', () => {
	it('служебный перечень параметров из описания убирается, остальное остаётся', () => {
		expect(describeTemplate('Реестр сделок. Параметры: date_from/date_to, limit. Только xlsx; содержит ПДн.')).toBe('Реестр сделок. Только xlsx; содержит ПДн.');
		expect(describeTemplate('Реестр сделок. Параметры: date_from, columns, limit.')).toBe('Реестр сделок.');
		expect(describeTemplate('Документы на подпись (signature_documents) помесячно: число документов. Параметры: months, doc_type.')).toBe('Документы на подпись помесячно: число документов.');
		expect(describeTemplate('Конверсия и среднее время.')).toBe('Конверсия и среднее время.');
	});
	it('технические ключи прав и источников заменяются русскими словами', () => {
		expect(describeTemplate('ФИО маскируются без права contact:reveal.')).toBe('ФИО маскируются без права просмотра персональных данных.');
		expect(describeTemplate('Пусто, если источник lms не присылал данных.')).toBe('Пусто, если источник LMS не присылал данных.');
	});
});

describe('срок хранения', () => {
	const now = new Date('2026-09-20T12:00:00Z');
	it('истёкший completed нельзя скачать', () => {
		expect(isReportExpired({ status: 'completed', expires_at: '2026-09-19T00:00:00Z' }, now)).toBe(true);
		expect(canDownloadReport({ status: 'completed', expires_at: '2026-09-27T00:00:00Z' }, now)).toBe(true);
		expect(canDownloadReport({ status: 'processing', expires_at: null }, now)).toBe(false);
		expect(isReportExpired({ status: 'failed', expires_at: '2026-09-19T00:00:00Z' }, now)).toBe(false);
	});
});

describe('состояние файла отчёта', () => {
	const now = new Date('2026-10-18T12:00:00Z');
	const future = '2026-10-25T00:00:00Z';
	it('готов с будущим сроком — ready; с прошедшим — expired', () => {
		expect(fileState({ status: 'completed', expires_at: future }, { now })).toBe('ready');
		expect(fileState({ status: 'completed', expires_at: '2026-10-17T00:00:00Z' }, { now })).toBe('expired');
	});
	it('файла нет (file_id = null) или сервер уже ответил 410 — gone, даже при будущем сроке', () => {
		expect(fileState({ status: 'completed', expires_at: future, file_id: null }, { now })).toBe('gone');
		expect(fileState({ status: 'completed', expires_at: future, file_id: 'f' }, { now, gone: true })).toBe('gone');
		expect(fileState({ status: 'completed', expires_at: future, file_id: 'f' }, { now })).toBe('ready');
	});
	it('очередь и обработка — pending, ошибка — failed; скачать можно только ready', () => {
		expect(fileState({ status: 'queued' })).toBe('pending');
		expect(fileState({ status: 'processing' })).toBe('pending');
		expect(fileState({ status: 'failed' })).toBe('failed');
		expect(canDownloadReport({ status: 'completed', expires_at: future, file_id: null }, now)).toBe(false);
	});
});

describe('JSON-выдача', () => {
	it('готовый отчёт любого вида, кроме «только файлом»; истёкший файл не мешает', () => {
		expect(canDownloadJson({ status: 'completed', template_code: 'deal_register' })).toBe(true);
		expect(canDownloadJson({ status: 'completed', template_code: 'lms_users_upload' })).toBe(false);
		expect(canDownloadJson({ status: 'failed', template_code: 'deal_register' })).toBe(false);
		expect(canDownloadJson({ status: 'queued', template_code: 'deal_register' })).toBe(false);
		expect(canDownloadJson({ status: 'completed', template_code: 'deal_register', expires_at: '2020-01-01T00:00:00Z' } as never)).toBe(true);
	});
});

describe('normalizePosition', () => {
	it('приводит произвольный position к сетке', () => {
		expect(normalizePosition(undefined, 3)).toEqual({ x: 0, y: 3, w: 6, h: 1 });
		expect(normalizePosition({ x: 10, w: 6 })).toEqual({ x: 6, y: 0, w: 6, h: 1 });
		expect(normalizePosition({ w: 40, h: 0.2 })).toEqual({ x: 0, y: 0, w: 12, h: 1 });
	});
});

describe('выгрузка учащихся в LMS (lms_users_upload)', () => {
	const defs = paramsFor('lms_users_upload');

	it('курс, поток и период — необязательные параметры, общего блока нет', () => {
		expect(defs.map((d) => d.key)).toEqual(['product_id', 'stream_number', 'date_from', 'date_to']);
		expect(defs.some((d) => d.group === 'scope')).toBe(false);
		expect(defs.every((d) => !d.required)).toBe(true);
		expect(validateParams(defs, {})).toEqual({});
	});

	it('пустые значения в тело не попадают, заполненные — попадают как есть', () => {
		expect(normalizeParams(defs, {})).toEqual({});
		expect(normalizeParams(defs, { product_id: 'p1', stream_number: 2, date_from: '2026-03-01' })).toEqual({ product_id: 'p1', stream_number: 2, date_from: '2026-03-01' });
	});

	it('номер потока — целое от 1', () => {
		expect(validateParams(defs, { stream_number: 0 }).stream_number).toBeTruthy();
		expect(validateParams(defs, { stream_number: 1.5 }).stream_number).toBeTruthy();
	});
});
