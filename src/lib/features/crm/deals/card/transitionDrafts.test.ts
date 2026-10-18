import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllDrafts, clearDraft, draftKey, getDraft, setDraft } from './transitionDrafts';

const file = { attachmentId: 'a1', fileId: 'f1', name: 'договор.pdf', size: 1000, category: 'contract' };

beforeEach(() => clearAllDrafts());

describe('черновики диалога перехода', () => {
	it('черновик восстанавливается по паре «сделка + переход», у другого перехода — пусто', () => {
		setDraft(draftKey('d1', 't1'), { comment: 'Договор согласован', values: { amount: '100' }, files: [file] });
		expect(getDraft(draftKey('d1', 't1'))).toEqual({ comment: 'Договор согласован', values: { amount: '100' }, files: [file] });
		expect(getDraft(draftKey('d1', 't2'))).toBeUndefined();
		expect(getDraft(draftKey('d2', 't1'))).toBeUndefined();
	});
	it('очищается после успеха или отмены; пустой черновик не хранится', () => {
		const key = draftKey('d1', 't1');
		setDraft(key, { comment: 'x', values: {}, files: [] });
		clearDraft(key);
		expect(getDraft(key)).toBeUndefined();
		setDraft(key, { comment: '  ', values: { a: null, b: '' }, files: [] });
		expect(getDraft(key)).toBeUndefined();
	});
	it('файл без комментария — тоже черновик', () => {
		setDraft('k', { comment: '', values: {}, files: [file] });
		expect(getDraft('k')?.files).toHaveLength(1);
	});
	it('отданная копия не меняет хранимую', () => {
		setDraft('k', { comment: 'x', values: {}, files: [file] });
		const copy = getDraft('k')!;
		copy.files.push({ ...file, attachmentId: 'a2' });
		copy.comment = 'другое';
		expect(getDraft('k')).toMatchObject({ comment: 'x', files: [file] });
	});
	it('clearAllDrafts стирает всё (выход из системы)', () => {
		setDraft('k1', { comment: 'x', values: {}, files: [] });
		setDraft('k2', { comment: 'y', values: {}, files: [] });
		clearAllDrafts();
		expect([getDraft('k1'), getDraft('k2')]).toEqual([undefined, undefined]);
	});
});
