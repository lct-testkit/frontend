import { describe, expect, it } from 'vitest';
import {
	AUDIT_ACTION_LABEL,
	approvalOperationLabel,
	auditActionLabel,
	blockerHint,
	entityTypeLabel,
	roleLabel,
	userStatusMeta
} from './labels';

describe('labels', () => {
	it('роли и статусы', () => {
		expect(roleLabel('HEAD')).toBe('Руководитель');
		expect(roleLabel('X')).toBe('X');
		expect(userStatusMeta('blocked')).toEqual({ label: 'Заблокирован', tone: 'error' });
		expect(userStatusMeta('?')).toMatchObject({ tone: 'neutral' });
	});
	it('операции согласований', () => {
		expect(approvalOperationLabel('user.create_admin')).toBe('Создание администратора');
	});
	it('блокеры с подсказкой и действием', () => {
		expect(blockerHint('active_deals').action).toBe('offboard');
		expect(blockerHint('has_signatures').action).toBeNull();
		expect(blockerHint('custom', 'Текст бэкенда')).toEqual({ label: 'custom', hint: 'Текст бэкенда', action: null });
	});
	it('каталог аудита покрывает ключевые действия и падает мягко', () => {
		for (const action of ['USER_CREATED', 'SIGNATURE_SIGNED', 'ERASURE_EXECUTED', 'ACCESS_DENIED', 'FEATURE_FLAG_CHANGED']) {
			expect(AUDIT_ACTION_LABEL[action]).toBeTruthy();
		}
		expect(auditActionLabel('NEW_ACTION')).toBe('NEW_ACTION');
		expect(entityTypeLabel(null)).toBe('—');
		expect(entityTypeLabel('deal')).toBe('Сделка');
	});
});
