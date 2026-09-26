import { describe, expect, it } from 'vitest';
import { canDownloadReport, isReportExpired, normalizeParams, normalizePosition, paramsFor, validateParams } from './params';

describe('параметры отчётов', () => {
	it('paramsFor подставляет default_params шаблона', () => {
		const defs = paramsFor('monthly_dynamics', { months: 6 });
		expect(defs[0]).toMatchObject({ key: 'months', default: 6, min: 1, max: 36 });
		expect(paramsFor('kam_summary')).toEqual([]);
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

describe('normalizePosition', () => {
	it('приводит произвольный position к сетке', () => {
		expect(normalizePosition(undefined, 3)).toEqual({ x: 0, y: 3, w: 6, h: 1 });
		expect(normalizePosition({ x: 10, w: 6 })).toEqual({ x: 6, y: 0, w: 6, h: 1 });
		expect(normalizePosition({ w: 40, h: 0.2 })).toEqual({ x: 0, y: 0, w: 12, h: 1 });
	});
});

describe('выгрузка учащихся в LMS (lms_users_upload)', () => {
	const defs = paramsFor('lms_users_upload');

	it('курс, поток и период — необязательные параметры', () => {
		expect(defs.map((d) => d.key)).toEqual(['product_id', 'stream_number', 'date_from', 'date_to']);
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
