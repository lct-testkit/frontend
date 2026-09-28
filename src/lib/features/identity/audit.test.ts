import { describe, expect, it } from 'vitest';
import { entityLabel, ensureAuditEntities, fieldLabel, formatChanges, formatValue, shortId } from './audit';

describe('formatValue', () => {
	it('пустое, булево, числа, массивы, объекты', () => {
		expect(formatValue(null)).toBe('—');
		expect(formatValue(true)).toBe('Да');
		expect(formatValue(1250000)).toBe('1 250 000');
		expect(formatValue(['a', 'b'])).toBe('a, b');
		expect(formatValue({ x: 1 })).toBe('{"x":1}');
	});
});

describe('formatChanges', () => {
	it('разбирает {old,new}', () => {
		expect(formatChanges({ role: { old: 'KAM', new: 'HEAD' } })).toEqual([{ field: 'role', oldValue: 'KAM', newValue: 'HEAD', isFact: false }]);
	});
	it('разбирает [old,new] и факты', () => {
		expect(formatChanges({ status: ['active', 'blocked'], required: ['user:write'], reason: { old: null, new: 'отпуск' } })).toEqual([
			{ field: 'status', oldValue: 'active', newValue: 'blocked', isFact: false },
			{ field: 'required', oldValue: '—', newValue: 'user:write', isFact: true },
			{ field: 'reason', oldValue: '—', newValue: 'отпуск', isFact: true }
		]);
	});
	it('пусто', () => {
		expect(formatChanges(null)).toEqual([]);
	});
	it('подписи полей и короткий id', () => {
		expect(fieldLabel('sessions_terminated')).toBe('Сессий завершено');
		expect(fieldLabel('unknown_field')).toBe('unknown_field');
		expect(shortId('0192a1b2-3c4d-7e8f-9a0b-1c2d3e4f5a6b')).toBe('0192a1b2…5a6b');
		expect(shortId(null)).toBe('—');
	});
});

describe('entityLabel — колонка «Сущность» журнала аудита (раньше показывала только фрагмент id)', () => {
	it('без id — null; тип без клиентского кэша (файл, задача…) — тоже null: снаружи это короткий id, как и раньше', () => {
		expect(entityLabel('deal', null)).toBeNull();
		expect(entityLabel(null, 'x')).toBeNull();
		expect(entityLabel('file', 'file-1')).toBeNull();
		expect(entityLabel('task', 'task-1')).toBeNull();
	});
});

describe('ensureAuditEntities', () => {
	it('не падает на пустом списке и на типах без кэша — фильтры по типу просто не находят ни одной записи', () => {
		expect(() => ensureAuditEntities([])).not.toThrow();
		expect(() => ensureAuditEntities([{ entity_type: 'file', entity_id: 'f-1' }])).not.toThrow();
	});
});
