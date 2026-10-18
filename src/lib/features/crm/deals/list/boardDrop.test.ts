import { describe, expect, it } from 'vitest';
import { createTransitionsCache, dropVerdict } from './boardDrop';

const t = (to: string, role_allowed: boolean) => ({ to_status_id: to, role_allowed });

describe('dropVerdict', () => {
	it('ok: переход есть и разрешён', () => expect(dropVerdict([t('a', true), t('b', false)], 'a')).toBe('ok'));
	it('role: переход есть, роли запрещён', () => expect(dropVerdict([t('a', true), t('b', false)], 'b')).toBe('role'));
	it('none: перехода в этот статус нет', () => expect(dropVerdict([t('a', true)], 'z')).toBe('none'));
	it('два перехода в один статус: хватает одного разрешённого', () => expect(dropVerdict([t('a', false), t('a', true)], 'a')).toBe('ok'));
});

describe('createTransitionsCache', () => {
	it('держит 30 с и забывает по delete', () => {
		let now = 1000;
		const cache = createTransitionsCache(() => now);
		cache.set('d1', []);
		now += 29_000;
		expect(cache.get('d1')).toEqual([]);
		now += 2_000;
		expect(cache.get('d1')).toBeUndefined();
		cache.set('d2', []);
		cache.delete('d2');
		expect(cache.get('d2')).toBeUndefined();
	});
});
