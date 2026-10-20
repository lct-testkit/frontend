import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	AUDIT_ACTION_LABEL,
	approvalOperationLabel,
	auditActionLabel,
	auditActionTitle,
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
		expect(auditActionLabel('NEW_ACTION')).toBe('Служебное действие');
		expect(entityTypeLabel(null)).toBe('—');
		expect(entityTypeLabel('deal')).toBe('Сделка');
	});
	it('RETENTION_APPLIED — «Очистка по сроку хранения»', () => {
		expect(auditActionLabel('RETENTION_APPLIED')).toBe('Очистка по сроку хранения');
	});
	it('неизвестный код — не сырой в ячейке, а «Действие: КОД» в подсказке', () => {
		expect(auditActionLabel('BRAND_NEW_ACTION')).toBe('Служебное действие');
		expect(auditActionTitle('BRAND_NEW_ACTION')).toBe('Действие: BRAND_NEW_ACTION');
		expect(auditActionTitle('USER_CREATED')).toBe('USER_CREATED');
	});
	it('у каждого кода действий бэкенда есть русское название (docs/audit-actions.txt — выгрузка AuditAction)', () => {
		const codes = readFileSync(new URL('../../../../docs/audit-actions.txt', import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
		expect(codes.length).toBeGreaterThan(150);
		const missing = codes.filter((c) => !AUDIT_ACTION_LABEL[c]);
		expect(missing).toEqual([]);
		for (const c of codes) expect(AUDIT_ACTION_LABEL[c]).not.toBe(c);
	});
});
