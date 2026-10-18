import { describe, expect, it } from 'vitest';
import type { AccessRequest } from '../types';
import { accessUntil, effectiveStatus, requestActions, statusMeta, validateDays } from './accessRequests';

const req = (status: string, expires_at: string | null = null): AccessRequest => ({
	id: 'r', entity_id: 'o', entity_type: 'organization', requester_id: 'u', reason: 'нужно', status, created_at: '2026-10-01T00:00:00Z',
	decided_at: null, decided_by: null, decision_comment: null, expires_at
});
const NOW = Date.parse('2026-10-18T12:00:00Z');

describe('запросы доступа', () => {
	it('одобренный после срока считается истёкшим', () => {
		expect(effectiveStatus(req('approved', '2026-10-17T00:00:00Z'), NOW)).toBe('expired');
		expect(effectiveStatus(req('approved', '2026-11-17T00:00:00Z'), NOW)).toBe('approved');
		expect(effectiveStatus(req('pending'), NOW)).toBe('pending');
	});
	it('действия: входящие и мои', () => {
		expect(requestActions(req('pending'), 'inbox', NOW)).toMatchObject({ decide: true, revoke: false, cancel: false });
		expect(requestActions(req('approved', '2026-11-17T00:00:00Z'), 'inbox', NOW)).toMatchObject({ decide: false, revoke: true, open: true });
		expect(requestActions(req('approved', '2026-10-01T00:00:00Z'), 'inbox', NOW)).toMatchObject({ revoke: false, open: false });
		expect(requestActions(req('pending'), 'mine', NOW)).toMatchObject({ cancel: true, decide: false });
		expect(requestActions(req('rejected'), 'mine', NOW)).toMatchObject({ cancel: false });
	});
	it('срок в днях', () => {
		expect(validateDays(30)).toBeNull();
		expect(validateDays(null)).toBe('Укажите срок в днях');
		expect(validateDays(0)).toBe('От 1 до 365 дней');
		expect(validateDays(366)).toBe('От 1 до 365 дней');
		expect(validateDays(1.5)).toBe('От 1 до 365 дней');
	});
	it('подписи и срок', () => {
		expect(statusMeta('pending').label).toBe('Ожидает');
		expect(statusMeta('что-то').label).toBe('что-то');
		expect(accessUntil(req('approved', '2026-11-17T00:00:00Z'), () => '17.11.2026')).toBe('до 17.11.2026');
		expect(accessUntil(req('rejected'), () => 'x')).toBeNull();
	});
});
