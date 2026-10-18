import { describe, expect, it } from 'vitest';
import { isFunnelSnapshot, jobNoteInput, reportNotes } from './notes';

const plain = (s: string) => s.replace(/\s+/g, ' ');

describe('пометки к отчёту', () => {
	it('предел без признака сервера — осторожное предупреждение «могла не войти»', () => {
		const notes = reportNotes({ rowCount: 500, limit: 500 });
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({ kind: 'truncated', tone: 'warning' });
		expect(plain(notes[0].text)).toContain('В отчёте 500 строк — это предел «Не больше строк»');
		expect(notes[0].text).toContain('могла не войти');
	});

	it('сервер сообщил об усечении и общее число — «Показано 1 000 из 1 342»', () => {
		const [note] = reportNotes({ truncated: true, rowCount: 1000, totalRows: 1342, limit: 1000 });
		expect(plain(note.text)).toBe('Показано 1 000 из 1 342 строк: сработал предел «Не больше строк». Увеличьте его (до 5 000) или сузьте фильтры');
	});

	it('сервер сказал «не усечено» — пусто, даже если строк ровно по пределу', () => {
		expect(reportNotes({ truncated: false, rowCount: 500, limit: 500 })).toEqual([]);
	});

	it('строк меньше предела — пусто; пустые данные — пусто', () => {
		expect(reportNotes({ rowCount: 12, limit: 500 })).toEqual([]);
		expect(reportNotes({})).toEqual([]);
	});

	it('пометка про материализованное представление — снимок со временем', () => {
		const [note] = reportNotes({ note: 'Источник: материализованное представление (обновляется раз в 5 минут)', asOf: '2026-10-16T11:35:00Z' });
		expect(note).toMatchObject({ kind: 'snapshot', tone: 'info' });
		expect(note.text).toMatch(/раз в 5 минут, на \d{2}:\d{2}\./);
		expect(reportNotes({ snapshot: true })[0].text).not.toContain(', на ');
	});

	it('другая пометка выводится дословно', () => {
		expect(reportNotes({ note: 'Закрытых сделок в выборке: 4, SLA к ним не применяется' })).toEqual([
			{ kind: 'info', tone: 'info', text: 'Закрытых сделок в выборке: 4, SLA к ним не применяется' }
		]);
	});

	it('усечение и снимок вместе — два предупреждения', () => {
		const kinds = reportNotes({ truncated: true, rowCount: 5, totalRows: 9, snapshot: true }).map((n) => n.kind);
		expect(kinds).toEqual(['truncated', 'snapshot']);
	});
});

describe('снимок воронки', () => {
	it('только «Воронка по статусам» администратора без фильтров общего блока', () => {
		expect(isFunnelSnapshot('deal_funnel', { deal_type: 'b2b' }, true)).toBe(true);
		expect(isFunnelSnapshot('deal_funnel', { organization_ids: ['a'] }, true)).toBe(false);
		expect(isFunnelSnapshot('deal_funnel', { organization_ids: [] }, true)).toBe(true);
		expect(isFunnelSnapshot('deal_funnel', {}, false)).toBe(false);
		expect(isFunnelSnapshot('kam_summary', {}, true)).toBe(false);
	});
});

describe('вход пометок из задания', () => {
	it('берёт усечение и время из result_meta, предел — из params, снимок — по правилу воронки', () => {
		const job = {
			template_code: 'stuck_deals',
			params: { limit: 1 },
			row_count: 1,
			result_meta: { truncated: true, total_rows: 7, data_as_of: '2026-10-16T11:35:00Z' }
		};
		expect(jobNoteInput(job, true)).toEqual({ rowCount: 1, limit: 1, truncated: true, totalRows: 7, snapshot: false, asOf: '2026-10-16T11:35:00Z' });
		expect(reportNotes(jobNoteInput(job, true))[0].kind).toBe('truncated');
	});

	it('без result_meta (старое задание) работает запасное правило по пределу', () => {
		const input = jobNoteInput({ template_code: 'deal_register', params: { limit: 500 }, row_count: 500, result_meta: null }, false);
		expect(input.truncated).toBeNull();
		expect(reportNotes(input)).toHaveLength(1);
	});
});
