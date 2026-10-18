import { describe, expect, it } from 'vitest';
import { approvalActions, approvalExecuteHref, approvalIdFromError, describeApproval, rejectLabel, timeLeft } from './approvals';
import { approvalOperationLabel } from './labels';
import type { ApprovalOperation } from './types';

const future = new Date(Date.now() + 3_600_000).toISOString();
const past = new Date(Date.now() - 1_000).toISOString();
const base = { id: 'a1', operation: 'user.create_admin', payload: { email: 'a@rt.ru', full_name: 'Иванов И.', role: 'ADMIN' }, requested_by: 'me', expires_at: future };

describe('approvalActions', () => {
	it('свою pending подтвердить нельзя — только ждать', () => {
		expect(approvalActions({ ...base, status: 'pending' }, 'me')).toMatchObject({ canApprove: false, waitingForOther: true, canReject: true });
	});
	it('чужую pending можно подтвердить/отклонить', () => {
		expect(approvalActions({ ...base, status: 'pending' }, 'other')).toMatchObject({ canApprove: true, canReject: true, canExecute: false });
	});
	it('approved: инициатор выполняет', () => {
		expect(approvalActions({ ...base, status: 'approved' }, 'me').canExecute).toBe(true);
		expect(approvalActions({ ...base, status: 'approved' }, 'other').canExecute).toBe(false);
	});
	it('истёкшая — ничего', () => {
		const a = approvalActions({ ...base, status: 'pending', expires_at: past }, 'other');
		expect(a).toMatchObject({ canApprove: false, canReject: false, isExpired: true });
	});
});

describe('describeApproval / approvalExecuteHref', () => {
	it('описание создания администратора', () => {
		expect(describeApproval(base)).toBe('Создание администратора Иванов И. (a@rt.ru)');
	});
	it('описание обезличивания', () => {
		expect(describeApproval({ operation: 'user.erasure', payload: { user_id: 'u', mode: 'anonymize' } })).toBe('Удаление/обезличивание сотрудника: обезличивание');
	});
	it('ссылка на повтор запроса', () => {
		expect(approvalExecuteHref(base)).toBe('/admin/users?approval_id=a1&create=1&email=a%40rt.ru&full_name=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2+%D0%98.&role=ADMIN');
		expect(approvalExecuteHref({ id: 'a2', operation: 'contact.erasure', payload: { contact_id: 'c1', mode: 'hard_delete' } })).toBe('/admin/erasure?approval_id=a2&subject_type=contact&subject_id=c1&mode=hard_delete');
		expect(approvalExecuteHref({ id: 'a3', operation: 'weird', payload: {} })).toBeNull();
	});
	it('approvalIdFromError', () => {
		expect(approvalIdFromError({ approval_id: 'x' })).toBe('x');
		expect(approvalIdFromError(null)).toBeNull();
	});
});

describe('назначение администратора (user.promote_admin)', () => {
	const promote = { id: 'a9', operation: 'user.promote_admin', payload: { user_id: 'u7', role: 'ADMIN' } };
	it('описание не падает без имени в справочнике, ссылка ведёт в карточку с approval_id и ролью', () => {
		expect(describeApproval(promote)).toMatch(/^Назначение администратора/);
		expect(approvalExecuteHref(promote)).toBe('/admin/users/u7?approval_id=a9&role=ADMIN');
	});
	it('неизвестная операция описывается кодом и не падает', () => {
		expect(describeApproval({ operation: 'brand.new', payload: null as never })).toBe('brand.new');
	});
});

describe('timeLeft / rejectLabel', () => {
	const now = Date.parse('2026-10-18T10:00:00Z');
	it('срок: далёкая заявка, меньше часа, истёкшая и без даты', () => {
		expect(timeLeft('2026-10-19T09:30:00Z', now)).toBe('ещё 23 ч');
		expect(timeLeft('2026-10-18T10:20:00Z', now)).toBe('меньше часа');
		expect(timeLeft('2026-10-18T09:00:00Z', now)).toBeNull();
		expect(timeLeft(null, now)).toBeNull();
	});
	it('своя заявка — «Отозвать», чужая — «Отклонить»', () => {
		expect(rejectLabel('me', 'me')).toBe('Отозвать');
		expect(rejectLabel('other', 'me')).toBe('Отклонить');
	});
});

describe('подписи операций', () => {
	it('у каждой операции из ApprovalOperation есть подпись, а не сырой код', () => {
		const ops: ApprovalOperation[] = ['user.create_admin', 'user.promote_admin', 'user.erasure', 'contact.erasure', 'organization.erasure'];
		for (const op of ops) expect(approvalOperationLabel(op), op).not.toBe(op);
	});
});
