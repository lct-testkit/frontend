import { describe, expect, it } from 'vitest';
import { dueGroup, isOpenTask, isOverdue, toDueIso, toLocalDate } from './taskUtils';

const NOW = new Date('2026-09-20T12:00:00').getTime();
const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe('taskUtils', () => {
	it('срок-дата ↔ ISO без сдвига дня', () => {
		expect(toLocalDate(toDueIso('2026-09-25'))).toBe('2026-09-25');
	});
	it('просрочена только открытая задача с прошедшим сроком', () => {
		expect(isOverdue({ status: 'open', due_at: at(-1) }, NOW)).toBe(true);
		expect(isOverdue({ status: 'done', due_at: at(-1) }, NOW)).toBe(false);
		expect(isOverdue({ status: 'open', due_at: null }, NOW)).toBe(false);
		expect(isOpenTask({ status: 'in_progress' })).toBe(true);
	});
	it('группы по сроку', () => {
		expect(dueGroup({ status: 'open', due_at: at(-2) }, NOW)).toBe('overdue');
		expect(dueGroup({ status: 'open', due_at: at(0.2) }, NOW)).toBe('today');
		expect(dueGroup({ status: 'open', due_at: at(3) }, NOW)).toBe('week');
		expect(dueGroup({ status: 'open', due_at: at(20) }, NOW)).toBe('later');
		expect(dueGroup({ status: 'open', due_at: null }, NOW)).toBe('none');
		expect(dueGroup({ status: 'done', due_at: at(-2) }, NOW)).not.toBe('overdue');
	});
});
