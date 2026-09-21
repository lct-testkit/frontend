import { describe, expect, it } from 'vitest';
import { approvalActions, approvalExecuteHref, approvalIdFromError, describeApproval } from './approvals';

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
