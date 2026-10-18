import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_RECENT_KEY, RECENT_KEY, clearRecent, localRecent, mergeRecent, pushRecent } from './localRecent';

function fakeStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k) => data.get(k) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (k) => void data.delete(k),
		setItem: (k, v) => void data.set(k, String(v))
	};
}

beforeEach(() => {
	vi.stubGlobal('localStorage', fakeStorage());
	vi.useRealTimers();
});

describe('localRecent', () => {
	it('11-я запись вытесняет самую старую', () => {
		vi.useFakeTimers();
		for (let i = 0; i < 11; i += 1) {
			vi.setSystemTime(new Date(2026, 9, 18, 10, i));
			pushRecent('u1', { type: 'organization', id: `org-${i}` });
		}
		const ids = localRecent('u1').map((r) => r.id);
		expect(ids).toHaveLength(10);
		expect(ids[0]).toBe('org-10');
		expect(ids).not.toContain('org-0');
	});

	it('повторное открытие поднимает запись наверх без дубля', () => {
		pushRecent('u1', { type: 'organization', id: 'a' });
		pushRecent('u1', { type: 'contact', id: 'b' });
		pushRecent('u1', { type: 'organization', id: 'a' });
		expect(localRecent('u1').map((r) => `${r.type}:${r.id}`)).toEqual(['organization:a', 'contact:b']);
	});

	it('в сохранённом JSON нет названий', () => {
		pushRecent('u1', { type: 'contact', id: 'b', title: 'Иванов Иван Иванович' } as { type: string; id: string });
		const raw = localStorage.getItem(RECENT_KEY) ?? '';
		expect(raw).not.toContain('title');
		expect(raw).not.toContain('Иванов');
		expect(JSON.parse(raw).u1[0]).toEqual({ type: 'contact', id: 'b', opened_at: expect.any(String) });
	});

	it('старый ключ удаляется при первом чтении', () => {
		localStorage.setItem(LEGACY_RECENT_KEY, JSON.stringify({ u1: [{ type: 'contact', id: 'x', title: 'Петров Пётр', opened_at: '2026-10-01T00:00:00Z' }] }));
		expect(localRecent('u1')).toEqual([]);
		expect(localStorage.getItem(LEGACY_RECENT_KEY)).toBeNull();
	});

	it('clearRecent стирает только свой ключ', () => {
		localStorage.setItem('other', '1');
		pushRecent('u1', { type: 'organization', id: 'a' });
		clearRecent();
		expect(localStorage.getItem(RECENT_KEY)).toBeNull();
		expect(localStorage.getItem('other')).toBe('1');
	});

	it('хранилище бросает исключение — функции не падают', () => {
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
		expect(() => pushRecent('u1', { type: 'organization', id: 'a' })).not.toThrow();
		expect(localRecent('u1')).toEqual([]);
		expect(() => clearRecent()).not.toThrow();
	});

	it('без пользователя ничего не пишет и не читает', () => {
		pushRecent(null, { type: 'organization', id: 'a' });
		expect(localStorage.getItem(RECENT_KEY)).toBeNull();
		expect(localRecent(undefined)).toEqual([]);
	});
});

describe('mergeRecent', () => {
	const remote = [
		{ type: 'deal', id: 'd1', title: 'Сделка 1', opened_at: '2026-10-18T10:00:00Z' },
		{ type: 'report', id: 'r1', title: 'Отчёт', opened_at: '2026-10-18T10:05:00Z' }
	];
	const local = [
		{ type: 'organization', id: 'o1', opened_at: '2026-10-18T10:03:00Z' },
		{ type: 'deal', id: 'd1', opened_at: '2026-10-18T09:00:00Z' },
		{ type: 'contact', id: 'c1', opened_at: '2026-10-18T10:07:00Z' }
	];

	it('отбрасывает неизвестный вид, убирает повторы, сортирует по времени', () => {
		const rows = mergeRecent(remote, local, 10);
		expect(rows.map((r) => `${r.type}:${r.id}`)).toEqual(['contact:c1', 'organization:o1', 'deal:d1']);
		expect(rows[2].title).toBe('Сделка 1');
	});

	it('ограничивает limit', () => {
		expect(mergeRecent(remote, local, 2)).toHaveLength(2);
	});

	it('пропускает записи с непонятным временем', () => {
		expect(mergeRecent([], [{ type: 'contact', id: 'x', opened_at: 'вчера' }], 5)).toEqual([]);
	});
});
