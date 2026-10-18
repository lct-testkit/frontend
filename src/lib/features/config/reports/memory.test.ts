import { afterEach, describe, expect, it, vi } from 'vitest';
import { columnsKey, formatKey, recall, recallStrings, remember } from './memory';

afterEach(() => vi.unstubAllGlobals());

function fake() {
	const map = new Map<string, string>();
	return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
}

describe('запоминание выбора', () => {
	it('записывает и читает, undefined стирает', () => {
		vi.stubGlobal('localStorage', fake());
		remember(columnsKey('deal_register'), ['a', 'b']);
		expect(recallStrings(columnsKey('deal_register'))).toEqual(['a', 'b']);
		remember(formatKey('deal_register'), 'xls');
		expect(recall(formatKey('deal_register'))).toBe('xls');
		remember(columnsKey('deal_register'), undefined);
		expect(recallStrings(columnsKey('deal_register'))).toBeUndefined();
	});

	it('хранилище недоступно или бросает — без исключений, набор по умолчанию', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {
				throw new Error('denied');
			}
		});
		expect(() => remember('k', ['a'])).not.toThrow();
		expect(recall('k')).toBeUndefined();
		vi.unstubAllGlobals();
		expect(recall('нет такого')).toBeUndefined();
	});

	it('битое значение не ломает чтение, массив не из строк отвергается', () => {
		const s = fake();
		vi.stubGlobal('localStorage', s);
		s.setItem('k', '{не json');
		expect(recall('k')).toBeUndefined();
		s.setItem('k', '[1,2]');
		expect(recallStrings('k')).toBeUndefined();
	});
});
