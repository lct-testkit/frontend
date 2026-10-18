import { describe, expect, it } from 'vitest';
import { attachmentName, eventAttachmentId, fileEventSummary, hideDuplicatedEvents, sortFiles } from './dealHistoryFiles';

const ev = (event_type: string, payload: Record<string, unknown> | null = null) => ({ event_type, payload });

describe('файлы в истории сделки', () => {
	it('событие «Добавлен файл», чей файл уже показан под записью статуса, скрывается', () => {
		const events = [ev('FILE_ADDED', { attachment_id: 'a1' }), ev('OWNER_CHANGED', { attachment_id: 'a1' })];
		const out = hideDuplicatedEvents(events, new Set(['a1']));
		expect(out.map((e) => e.event_type)).toEqual(['OWNER_CHANGED']);
	});
	it('файл вне перехода (его нет под записью статуса) остаётся в ленте событий', () => {
		const events = [ev('FILE_ADDED', { attachment_id: 'a2' }), ev('FILE_ADDED', null)];
		expect(hideDuplicatedEvents(events, new Set(['a1']))).toHaveLength(2);
		expect(hideDuplicatedEvents(events, new Set())).toHaveLength(2);
	});
	it('запись без файлов даёт пустой список, файлы идут по времени', () => {
		expect(sortFiles([])).toEqual([]);
		const sorted = sortFiles([
			{ id: 'b', created_at: '2026-10-18T10:05:00Z' },
			{ id: 'a', created_at: '2026-10-18T10:01:00Z' },
			{ id: 'c', created_at: '2026-10-18T10:09:00Z' }
		]);
		expect(sorted.map((f) => f.id)).toEqual(['a', 'b', 'c']);
	});
	it('сортировка не меняет исходный массив', () => {
		const src = [{ created_at: '2' }, { created_at: '1' }];
		sortFiles(src);
		expect(src[0].created_at).toBe('2');
	});
	it('подпись события файла: имя и категория; без данных — пусто', () => {
		expect(fileEventSummary(ev('FILE_ADDED', { filename: 'договор.pdf', category: 'contract' }))).toBe('договор.pdf · Договор');
		expect(fileEventSummary(ev('FILE_ADDED', { filename: 'x.pdf', category: 'custom' }))).toBe('x.pdf · custom');
		expect(fileEventSummary(ev('FILE_ADDED', null))).toBe('');
		expect(eventAttachmentId(ev('FILE_ADDED', { attachment_id: 5 }))).toBeNull();
	});
	it('имя вложения: файл, затем описание, затем «Файл»', () => {
		expect(attachmentName({ file: { original_filename: 'a.pdf', size_bytes: 1, mime_type: 'x', status: 'ready' }, description: 'd' })).toBe('a.pdf');
		expect(attachmentName({ file: null, description: 'старое.pdf' })).toBe('старое.pdf');
		expect(attachmentName({ file: null, description: null })).toBe('Файл');
	});
});
