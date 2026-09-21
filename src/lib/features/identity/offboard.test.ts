import { describe, expect, it } from 'vitest';
import { dealsWord, summarizeWorkload, validateOffboard } from './offboard';

describe('summarizeWorkload', () => {
	it('собирает сводку из ответа preview', () => {
		const s = summarizeWorkload([
			{ kind: 'deals', count: 3, supported: true, details: [{ id: 'd1', number: 'B2B-1', title: 'КП', status: 'signing' }] },
			{ kind: 'tasks', count: 2, supported: true },
			{ kind: 'imports', count: 0, supported: true },
			{ kind: 'reports', count: 0, supported: true },
			{ kind: 'signature_requests', count: 1 }
		]);
		expect(s).toMatchObject({ deals: 3, tasks: 2, signatureRequests: 1, unsupported: false, isEmpty: false });
		expect(s.criticalDeals).toEqual([{ id: 'd1', number: 'B2B-1', title: 'КП', status: 'signing' }]);
	});
	it('пустая нагрузка и недоступный модуль', () => {
		expect(summarizeWorkload([{ kind: 'deals', count: 0 }]).isEmpty).toBe(true);
		expect(summarizeWorkload([{ kind: 'deals', count: 0, supported: false }])).toMatchObject({ unsupported: true, isEmpty: false });
	});
});

describe('validateOffboard', () => {
	const base = { userId: 'u1', successorId: 'u2', reason: 'увольнение', acknowledged: true };
	it('валидная форма', () => {
		expect(validateOffboard(base).ok).toBe(true);
	});
	it('преемник обязателен и не сам сотрудник', () => {
		expect(validateOffboard({ ...base, successorId: null }).errors.successorId).toBeTruthy();
		expect(validateOffboard({ ...base, successorId: 'u1' }).errors.successorId).toContain('совпадать');
	});
	it('причина ≥ 3 символов, подтверждение только на последнем шаге', () => {
		expect(validateOffboard({ ...base, reason: 'ab' }).errors.reason).toBeTruthy();
		expect(validateOffboard({ ...base, acknowledged: false }, 'successor').ok).toBe(true);
		expect(validateOffboard({ ...base, acknowledged: false }).errors.acknowledged).toBeTruthy();
	});
	it('склонение', () => {
		expect(dealsWord(1)).toBe('сделка');
		expect(dealsWord(3)).toBe('сделки');
		expect(dealsWord(12)).toBe('сделок');
	});
});
