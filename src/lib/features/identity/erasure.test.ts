import { describe, expect, it } from 'vitest';
import { blockerAction, erasureActions, erasureStepIndex, graceCountdown } from './erasure';

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe('graceCountdown', () => {
	it('дни', () => {
		expect(graceCountdown(iso(NOW + 12 * 86_400_000 + 3_600_000), NOW)).toMatchObject({ state: 'active', days: 12, label: 'Исполнение через 12 дней' });
		expect(graceCountdown(iso(NOW + 86_400_000), NOW).label).toBe('Исполнение через 1 день');
	});
	it('часы и истечение', () => {
		expect(graceCountdown(iso(NOW + 5 * 3_600_000), NOW).label).toBe('Исполнение через 5 часов');
		expect(graceCountdown(iso(NOW - 1), NOW).state).toBe('expired');
		expect(graceCountdown(null, NOW).state).toBe('none');
	});
});

describe('erasureActions', () => {
	it('blocked — только пересчёт и отказ', () => {
		expect(erasureActions({ status: 'blocked' }, NOW)).toEqual({ canRecheck: true, canReject: true, canRestore: false, canAct: false });
	});
	it('в отсрочке можно восстановить, пока она не истекла', () => {
		expect(erasureActions({ status: 'approved', grace_until: iso(NOW + 1000) }, NOW).canRestore).toBe(true);
		expect(erasureActions({ status: 'approved', grace_until: iso(NOW - 1000) }, NOW).canRestore).toBe(false);
	});
	it('completed — только акт', () => {
		expect(erasureActions({ status: 'completed', act_file_id: 'f' }, NOW)).toEqual({ canRecheck: false, canReject: false, canRestore: false, canAct: true });
	});
	it('шаги мастера', () => {
		expect(erasureStepIndex('blocked')).toBe(1);
		expect(erasureStepIndex('pending')).toBe(2);
		expect(erasureStepIndex('completed')).toBe(4);
	});
});

describe('blockerAction', () => {
	it('передача дел и карточка — только для сотрудника', () => {
		expect(blockerAction('offboard', 'user', 'u1')).toEqual({ label: 'Передать дела', href: '/admin/users/u1/offboard' });
		expect(blockerAction('block', 'user', 'u1')?.href).toBe('/admin/users/u1');
		expect(blockerAction('offboard', 'contact', 'c1')).toBeNull();
		expect(blockerAction('block', 'organization', 'o1')).toBeNull();
	});
	it('общие переходы и «снять нельзя»', () => {
		expect(blockerAction('tasks', 'contact', 'c1')?.href).toBe('/tasks');
		expect(blockerAction('users', 'user', 'u1')?.href).toBe('/admin/users');
		expect(blockerAction(null, 'user', 'u1')).toBeNull();
	});
});
